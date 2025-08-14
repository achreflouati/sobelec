frappe.provide('frappe.saisir_reglement_by_ciel');

frappe.saisir_reglement_by_ciel.SaisirReglementManager = class SaisirReglementManager {
    constructor(page) {
        this.page = page;
        this.page_id = `reglement_${frappe.utils.get_random(6)}`;
        this.filters = {
            party_type: 'Customer',
            party: '',
            company: frappe.defaults.get_default('company')
        };
        this.selected_invoices = new Set();
        this.payment_data = {
            mode_of_payment: '',
            account: '',
            reference_no: '',
            reference_date: frappe.datetime.nowdate(),
            amount: 0
        };
        
        this.make();
    }

    make() {
        this.make_page();
        this.setup_filters();
        this.setup_invoice_table();
        this.setup_payment_section();
        this.bind_events();
        this.refresh();
    }

    make_page() {
        // Page title
        this.page.set_title(__("Saisir Règlement by Ciel"));

        // Filters
        const fields = [
            {
                fieldtype: 'Select',
                fieldname: 'party_type',
                label: __('Type'),
                options: ['Customer', 'Supplier'],
                default: 'Customer',
                onchange: () => this.party_type_changed()
            },
            {
                fieldtype: 'Link',
                fieldname: 'party',
                label: __('Sélectionner'),
                options: 'Customer',
                onchange: () => this.party_changed(),
                get_query: () => ({
                    filters: { disabled: 0 }
                })
            }
        ];

        // Actions
        this.page.set_primary_action(__('Valider règlement'), () => this.save_payment(true));
        this.page.set_secondary_action(__('Enregistrer brouillon'), () => this.save_payment(false));
        this.page.add_menu_item(__('Actualiser'), () => this.refresh());

        // Add filters
        this.page.show_filters = true;
        this.page.add_field(fields);

        // Main content
        $(frappe.render_template('saisir_reglement_by_ciel', {
            page_id: this.page_id
        })).appendTo(this.page.main);
    }

    setup_filters() {
        // Update filters
        this.page.set_filter_value('party_type', this.filters.party_type);
    }

    setup_invoice_table() {
        this.invoice_table = $(`#invoices-${this.page_id}`).DataTable({
            columns: [
                { 
                    data: null,
                    render: (data) => `<input type="checkbox" class="invoice-select"
                        data-name="${data.name}" 
                        data-amount="${data.outstanding_amount}"
                        ${this.selected_invoices.has(data.name) ? 'checked' : ''}/>`
                },
                { data: 'name' },
                { 
                    data: 'posting_date',
                    render: (data) => frappe.datetime.str_to_user(data)
                },
                {
                    data: 'due_date',
                    render: (data) => frappe.datetime.str_to_user(data)
                },
                {
                    data: 'grand_total',
                    className: 'text-right',
                    render: (data) => format_currency(data, this.filters.currency)
                },
                {
                    data: 'paid_amount',
                    className: 'text-right',
                    render: (data) => format_currency(data, this.filters.currency)
                },
                {
                    data: 'outstanding_amount',
                    className: 'text-right',
                    render: (data) => format_currency(data, this.filters.currency)
                },
                {
                    data: null,
                    render: (data) => this.get_status_html(data)
                }
            ],
            ordering: false,
            searching: false,
            paging: false,
            info: false
        });
    }

    setup_payment_section() {
        // Initialize payment fields
        this.page.fields_dict.mode_of_payment = frappe.ui.form.make_control({
            parent: $(`.mode-of-payment`, this.page.main),
            df: {
                fieldtype: 'Link',
                options: 'Mode of Payment',
                label: '',
                get_query: () => ({ filters: { enabled: 1 } }),
                change: () => this.payment_data.mode_of_payment = this.page.fields_dict.mode_of_payment.get_value()
            },
            render_input: true
        });

        this.page.fields_dict.account = frappe.ui.form.make_control({
            parent: $(`.payment-account`, this.page.main),
            df: {
                fieldtype: 'Link',
                options: 'Account',
                label: '',
                get_query: () => ({
                    filters: {
                        account_type: ['in', ['Bank', 'Cash']],
                        is_group: 0,
                        company: this.filters.company
                    }
                }),
                change: () => this.payment_data.account = this.page.fields_dict.account.get_value()
            },
            render_input: true
        });

        // Set default values for date and bind events
        $(`.payment-date`, this.page.main).val(frappe.datetime.nowdate());

        $(`.payment-reference, .payment-date`, this.page.main).on('change', () => this.update_payment_data());
        $(`.payment-amount`, this.page.main).on('input', (e) => {
            this.payment_data.amount = parseFloat($(e.target).val()) || 0;
        });
    }

    bind_events() {
        // Party type change
        this.page.fields_dict.party_type.$input.on('change', () => {
            this.filters.party_type = this.page.fields_dict.party_type.get_value();
            this.party_type_changed();
        });

        // Party change
        this.page.fields_dict.party.$input.on('change', () => {
            this.filters.party = this.page.fields_dict.party.get_value();
            this.party_changed();
        });

        // Invoice selection
        this.page.main.on('change', '.invoice-select', (e) => {
            const $cb = $(e.target);
            const name = $cb.data('name');
            const amount = parseFloat($cb.data('amount'));

            if ($cb.is(':checked')) {
                this.selected_invoices.add({name, amount});
            } else {
                this.selected_invoices.delete(name);
            }
            
            this.update_selected_total();
        });

        // Select all invoices
        this.page.main.on('change', '.select-all', (e) => {
            const checked = $(e.target).is(':checked');
            $('.invoice-select', this.page.main).prop('checked', checked).trigger('change');
        });
    }

    refresh() {
        if (!this.filters.party) {
            this.clear_invoices();
            return;
        }

        frappe.call({
            method: 'sobelec_extension.api_reglement.get_open_invoices',
            args: this.filters,
            callback: (r) => {
                if (r.message) {
                    this.render_invoices(r.message);
                    this.update_stats(r.message);
                }
            }
        });
    }

    render_invoices(invoices) {
        this.invoice_table.clear();
        this.invoice_table.rows.add(invoices);
        this.invoice_table.draw();
    }

    party_type_changed() {
        let party_type = this.filters.party_type;
        this.page.fields_dict.party.df.options = party_type;
        this.page.fields_dict.party.df.get_query = () => ({
            filters: { disabled: 0 }
        });
        this.page.fields_dict.party.refresh();
        this.page.fields_dict.party.set_value('');
        this.filters.party = '';
        this.clear_invoices();
    }

    party_changed() {
        if (this.filters.party) {
            this.refresh();
        } else {
            this.clear_invoices();
        }
    }

    clear_invoices() {
        this.invoice_table.clear().draw();
        this.selected_invoices.clear();
        this.update_selected_total();
    }

    update_selected_total() {
        let total = Array.from(this.selected_invoices).reduce((sum, inv) => sum + inv.amount, 0);
        $(`#selected-total-${this.page_id}`).text(format_currency(total, this.filters.currency));
        $(`.payment-amount`, this.page.main).val(total);
        this.payment_data.amount = total;
    }

    save_payment(submit = false) {
        if (!this.validate_payment()) return;

        frappe.call({
            method: 'sobelec_extension.api_reglement.create_payment_entry',
            args: {
                party_type: this.filters.party_type,
                party: this.filters.party,
                payment_data: this.payment_data,
                invoices: Array.from(this.selected_invoices),
                submit: submit
            },
            callback: (r) => {
                if (r.message) {
                    frappe.show_alert({
                        message: submit ? __('Règlement validé') : __('Brouillon enregistré'),
                        indicator: 'green'
                    });
                    frappe.set_route('Form', 'Payment Entry', r.message);
                }
            }
        });
    }

    validate_payment() {
        if (!this.filters.party) {
            frappe.throw(__("Veuillez sélectionner un client/fournisseur"));
            return false;
        }

        if (!this.selected_invoices.size) {
            frappe.throw(__("Veuillez sélectionner au moins une facture"));
            return false;
        }

        if (!this.payment_data.mode_of_payment) {
            frappe.throw(__("Mode de paiement requis"));
            return false;
        }

        if (!this.payment_data.account) {
            frappe.throw(__("Compte bancaire requis"));
            return false;
        }

        if (!this.payment_data.amount) {
            frappe.throw(__("Montant requis"));
            return false;
        }

        return true;
    }

    get_status_html(data) {
        let status = '';
        let color = '';

        if (data.outstanding_amount <= 0) {
            status = __('Payée');
            color = 'green';
        } else if (data.paid_amount > 0) {
            status = __('Partiel');
            color = 'orange';
        } else if (frappe.datetime.get_diff(frappe.datetime.nowdate(), data.due_date) > 0) {
            status = __('En retard');
            color = 'red';
        } else {
            status = __('Ouverte');
            color = 'blue';
        }

        return `<span class="indicator-pill ${color}">${status}</span>`;
    }

    update_stats(invoices) {
        const total_balance = invoices.reduce((sum, inv) => sum + inv.outstanding_amount, 0);
        const unpaid_count = invoices.length;
        
        $(`#total-balance-${this.page_id}`).text(format_currency(total_balance, this.filters.currency));
        $(`#unpaid-count-${this.page_id}`).text(unpaid_count);
    }

    update_payment_data() {
        this.payment_data = {
            mode_of_payment: this.page.fields_dict.mode_of_payment.get_value(),
            account: this.page.fields_dict.account.get_value(),
            reference_no: $(`.payment-reference`, this.page.main).val(),
            reference_date: $(`.payment-date`, this.page.main).val(),
            amount: parseFloat($(`.payment-amount`, this.page.main).val()) || 0
        };
    }
};
