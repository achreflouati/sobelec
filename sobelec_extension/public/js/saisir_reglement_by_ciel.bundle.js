class SaisirReglementManager {
    constructor(wrapper) {
        this.wrapper = wrapper;
        this.page_id = `reglement_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
        
        this.init();
    }

    async init() {
        try {
            this.setup_page_structure();
            this.setup_filters();
            this.setup_event_handlers();
            await this.load_data();
            this.show_success_message("Interface initialisée avec succès");
        } catch (error) {
            this.handle_error("Erreur d'initialisation", error);
        }
    }

    setup_page_structure() {
        this.wrapper.innerHTML = `
            <div class="saisir-reglement-container">
                <!-- Header Section -->
                <div class="page-header">
                    <div class="row">
                        <div class="col-md-8">
                            <h2><i class="fa fa-money"></i> Saisie des règlements</h2>
                            <p class="text-muted">Interface de saisie des règlements style Ciel</p>
                        </div>
                    </div>
                </div>

                <!-- Filters Section -->
                <div class="filters-section card">
                    <div class="card-header">
                        <h4><i class="fa fa-filter"></i> Sélection</h4>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-4">
                                <label>Type</label>
                                <select class="form-control" id="party-type-${this.page_id}">
                                    <option value="Customer">Client</option>
                                    <option value="Supplier">Fournisseur</option>
                                </select>
                            </div>
                            <div class="col-md-8">
                                <label>Sélectionner</label>
                                <div id="party-field-${this.page_id}"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Stats Section -->
                <div class="stats-section">
                    <div class="row">
                        <div class="col-md-4">
                            <div class="stat-card">
                                <div class="stat-label">Solde total</div>
                                <div class="stat-value" id="total-balance-${this.page_id}">0.00</div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="stat-card">
                                <div class="stat-label">Factures impayées</div>
                                <div class="stat-value" id="unpaid-count-${this.page_id}">0</div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="stat-card">
                                <div class="stat-label">Dernier règlement</div>
                                <div class="stat-value" id="last-payment-${this.page_id}">-</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Invoices Section -->
                <div class="invoices-section card">
                    <div class="card-header">
                        <h4><i class="fa fa-file-text"></i> Factures</h4>
                    </div>
                    <div class="card-body">
                        <div class="table-responsive">
                            <table class="table table-bordered" id="invoices-${this.page_id}">
                                <thead>
                                    <tr>
                                        <th width="30px">
                                            <input type="checkbox" class="select-all"/>
                                        </th>
                                        <th>N° Facture</th>
                                        <th>Date</th>
                                        <th>Échéance</th>
                                        <th class="text-right">Montant total</th>
                                        <th class="text-right">Payé</th>
                                        <th class="text-right">Solde</th>
                                        <th>Statut</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td colspan="8" class="text-center text-muted">
                                            Sélectionnez un client/fournisseur
                                        </td>
                                    </tr>
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <th colspan="4">Total sélectionné</th>
                                        <th class="text-right" id="selected-total-${this.page_id}">0.00</th>
                                        <th class="text-right" id="selected-paid-${this.page_id}">0.00</th>
                                        <th class="text-right" id="selected-balance-${this.page_id}">0.00</th>
                                        <th></th>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- Payment Section -->
                <div class="payment-section card">
                    <div class="card-header">
                        <h4><i class="fa fa-credit-card"></i> Saisie du règlement</h4>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-3">
                                <div class="form-group">
                                    <label>Mode de paiement</label>
                                    <div class="mode-of-payment-field-${this.page_id}" id="mode-of-payment-field-${this.page_id}"></div>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="form-group">
                                    <label>Compte</label>
                                    <div class="account-field-${this.page_id}"id="account-field-${this.page_id}"></div>
                                </div>
                            </div>
                            <div class="col-md-2">
                                <div class="form-group">
                                    <label>Date</label>
                                    <input type="date" class="form-control payment-date"
                                           value="${frappe.datetime.nowdate()}"/>
                                </div>
                            </div>
                            <div class="col-md-2">
                                <div class="form-group">
                                    <label>Référence</label>
                                    <input type="text" class="form-control payment-reference"
                                           placeholder="N° chèque..."/>
                                </div>
                            </div>
                            <div class="col-md-2">
                                <div class="form-group">
                                    <label>Montant</label>
                                    <input type="number" class="form-control text-right payment-amount"
                                           step="0.01"/>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="card-footer text-right">
                        <button class="btn btn-secondary" id="draft-payment-${this.page_id}">
                            <i class="fa fa-save"></i> Enregistrer brouillon
                        </button>
                        <button class="btn btn-primary" id="submit-payment-${this.page_id}">
                            <i class="fa fa-check"></i> Valider règlement
                        </button>
                    </div>
                </div>
            </div>
        `;

        this.setup_styles();
    }

    setup_styles() {
        const style = document.createElement('style');
        style.textContent = `
            .saisir-reglement-container {
                padding: 15px;
            }

            .card {
                margin-bottom: 20px;
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius);
            }

            .card-header {
                background-color: var(--fg-color);
                padding: 10px 15px;
                border-bottom: 1px solid var(--border-color);
            }

            .card-header h4 {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
            }

            .card-body {
                padding: 15px;
                background-color: var(--fg-color);
            }

            .card-footer {
                padding: 15px;
                background-color: var(--fg-color);
                border-top: 1px solid var(--border-color);
            }

            .stats-section {
                margin-bottom: 20px;
            }

            .stat-card {
                background: var(--fg-color);
                padding: 15px;
                border-radius: var(--border-radius);
                box-shadow: var(--card-shadow);
            }

            .stat-label {
                color: var(--text-muted);
                font-size: 0.9em;
            }

            .stat-value {
                font-size: 1.5em;
                font-weight: bold;
                color: var(--text-color);
            }

            .table thead th {
                background: var(--fg-color);
                border-bottom: 2px solid var(--border-color);
            }

            .table tbody tr.paid {
                background-color: var(--green-50);
            }

            .table tbody tr.overdue {
                background-color: var(--red-50);
            }
        `;
        document.head.appendChild(style);
    }

    setup_filters() {
        // Party field setup
        this.party_field = frappe.ui.form.make_control({
            parent: $(`#party-field-${this.page_id}`),
            df: {
                fieldtype: 'Link',
                options: this.filters.party_type,
                label: '',
                placeholder: 'Rechercher...',
                get_query: () => ({
                    filters: { disabled: 0 }
                }),
                change: () => {
                    this.filters.party = this.party_field.get_value();
                    this.load_data();
                }
            },
            render_input: true
        });
        // Mode of Payment field
        this.mode_of_payment_field = frappe.ui.form.make_control({
            parent: $(`#mode-of-payment-field-${this.page_id}`),
            df: {
                fieldtype: 'Link',
                options: 'Mode of Payment',
                label: '',
                placeholder: 'Sélectionner...',
                get_query: () => ({
                    filters: { enabled: 1 }
                }),
                change: () => {
                    this.payment_data.mode_of_payment = this.mode_of_payment_field.get_value();
                }
            },
            render_input: true
        });
         // Account field
        this.account_field = frappe.ui.form.make_control({
            parent: $(`.account-field-${this.page_id}`),
            df: {
                fieldtype: 'Link',
                options: 'Account',
                label: '',
                placeholder: 'Sélectionner...',
                get_query: () => ({
                    filters: {
                        account_type: ['in', ['Bank', 'Cash']],
                        is_group: 0,
                        company: this.filters.company
                    }
                }),
                change: () => {
                    this.payment_data.account = this.account_field.get_value();
                }
            },
            render_input: true
        });
    }

    setup_payment_fields() {
        // Mode of Payment field
        this.mode_of_payment_field = frappe.ui.form.make_control({
            parent: $(`#mode-of-payment-field-${this.page_id}`),
            df: {
                fieldtype: 'Link',
                options: 'Mode of Payment',
                label: '',
                placeholder: 'Sélectionner...',
                get_query: () => ({
                    filters: { enabled: 1 }
                }),
                change: () => {
                    this.payment_data.mode_of_payment = this.mode_of_payment_field.get_value();
                }
            },
            render_input: true
        });
        

        // Account field
        this.account_field = frappe.ui.form.make_control({
            parent: $(`.account-field-${this.page_id}`),
            df: {
                fieldtype: 'Link',
                options: 'Account',
                label: '',
                placeholder: 'Sélectionner...',
                get_query: () => ({
                    filters: {
                        account_type: ['in', ['Bank', 'Cash']],
                        is_group: 0,
                        company: this.filters.company
                    }
                }),
                change: () => {
                    this.payment_data.account = this.account_field.get_value();
                }
            },
            render_input: true
        });
    }

    setup_event_handlers() {
        // Party type change
        $(`#party-type-${this.page_id}`).on('change', (e) => {
            this.filters.party_type = $(e.target).val();
            this.party_field.df.options = this.filters.party_type;
            this.party_field.refresh();
            this.party_field.set_value('');
            this.clear_data();
        });

        // Invoice selection
        this.setup_invoice_selection_handlers();

        // Payment fields
        this.setup_payment_handlers();

        // Buttons
        $(`#draft-payment-${this.page_id}`).on('click', () => this.save_payment(false));
        $(`#submit-payment-${this.page_id}`).on('click', () => this.save_payment(true));
    }

    setup_invoice_selection_handlers() {
        // Select all invoices
        $('.select-all', this.wrapper).on('change', (e) => {
            const checked = $(e.target).is(':checked');
            $('.invoice-select', this.wrapper).prop('checked', checked).trigger('change');
        });

        // Individual invoice selection
        $(this.wrapper).on('change', '.invoice-select', (e) => {
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
    }

    setup_payment_handlers() {
        $(`.payment-reference, .payment-date`, this.wrapper).on('change', () => this.update_payment_data());
        $(`.payment-amount`, this.wrapper).on('input', (e) => {
            this.payment_data.amount = parseFloat($(e.target).val()) || 0;
        });
    }

    async load_data() {
        if (!this.filters.party) {
            this.clear_data();
            return;
        }

        this.show_loading();

        try {
            const response = await frappe.call({
                method: 'sobelec_extension.api_reglement.get_open_invoices',
                args: this.filters
            });

            if (response.message) {
                this.render_invoices(response.message);
                this.update_stats(response.message);
            }
        } catch (error) {
            this.handle_error("Erreur de chargement", error);
        } finally {
            this.hide_loading();
        }
    }

    render_invoices(invoices) {
        const $tbody = $('#invoices-' + this.page_id + ' tbody');
        
        if (!invoices.length) {
            $tbody.html(`
                <tr>
                    <td colspan="8" class="text-center text-muted">
                        Aucune facture impayée trouvée
                    </td>
                </tr>
            `);
            return;
        }

        const rows = invoices.map(inv => {
            const status_html = this.get_status_html(inv);
            return `
                <tr class="${this.get_status_class(inv)}">
                    <td>
                        <input type="checkbox" class="invoice-select"
                               data-name="${inv.name}"
                               data-amount="${inv.outstanding_amount}"/>
                    </td>
                    <td>${inv.name}</td>
                    <td>${frappe.datetime.str_to_user(inv.posting_date)}</td>
                    <td>${frappe.datetime.str_to_user(inv.due_date)}</td>
                    <td class="text-right">${format_currency(inv.grand_total)}</td>
                    <td class="text-right">${format_currency(inv.paid_amount)}</td>
                    <td class="text-right">${format_currency(inv.outstanding_amount)}</td>
                    <td>${status_html}</td>
                </tr>
            `;
        }).join('');

        $tbody.html(rows);
    }

    get_status_html(invoice) {
        let status = '';
        let color = '';

        if (invoice.outstanding_amount <= 0) {
            status = __('Payée');
            color = 'green';
        } else if (invoice.paid_amount > 0) {
            status = __('Partiel');
            color = 'orange';
        } else if (frappe.datetime.get_diff(frappe.datetime.nowdate(), invoice.due_date) > 0) {
            status = __('En retard');
            color = 'red';
        } else {
            status = __('Ouverte');
            color = 'blue';
        }

        return `<span class="indicator-pill ${color} ellipsis">${status}</span>`;
    }

    get_status_class(invoice) {
        if (invoice.outstanding_amount <= 0) return 'paid';
        if (frappe.datetime.get_diff(frappe.datetime.nowdate(), invoice.due_date) > 0) {
            return 'overdue';
        }
        return '';
    }

    update_stats(invoices) {
        const total_balance = invoices.reduce((sum, inv) => sum + inv.outstanding_amount, 0);
        const unpaid_count = invoices.length;
        
        $(`#total-balance-${this.page_id}`).text(format_currency(total_balance));
        $(`#unpaid-count-${this.page_id}`).text(unpaid_count);
    }

    update_selected_total() {
        let total = Array.from(this.selected_invoices).reduce((sum, inv) => sum + inv.amount, 0);
        $(`#selected-total-${this.page_id}`).text(format_currency(total));
        $(`.payment-amount`, this.wrapper).val(total);
        this.payment_data.amount = total;
    }

    update_payment_data() {
        this.payment_data = {
            mode_of_payment: this.mode_of_payment_field.get_value(),
            account: this.account_field.get_value(),
            reference_no: $(`.payment-reference`, this.wrapper).val(),
            reference_date: $(`.payment-date`, this.wrapper).val(),
            amount: parseFloat($(`.payment-amount`, this.wrapper).val()) || 0
        };
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
                    this.show_success_message(
                        submit ? 'Règlement validé' : 'Brouillon enregistré'
                    );
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

    clear_data() {
        $('#invoices-' + this.page_id + ' tbody').html(`
            <tr>
                <td colspan="8" class="text-center text-muted">
                    Sélectionnez un client/fournisseur
                </td>
            </tr>
        `);
        this.selected_invoices.clear();
        this.update_selected_total();
        this.update_stats([]);
    }

    show_loading() {
        this.wrapper.classList.add('loading');
        if (!this.$loading) {
            this.$loading = $(`<div class="loading-overlay">
                <div class="loading-spinner"></div>
            </div>`).appendTo(this.wrapper);
        }
        this.$loading.show();
    }

    hide_loading() {
        this.wrapper.classList.remove('loading');
        if (this.$loading) {
            this.$loading.hide();
        }
    }

    show_success_message(message) {
        frappe.show_alert({
            message: __(message),
            indicator: 'green'
        });
    }

    handle_error(title, error) {
        console.error(title, error);
        frappe.msgprint({
            title: __(title),
            indicator: 'red',
            message: __(error.message || error.toString())
        });
    }
}

// Make sure to export the class
frappe.provide('frappe.saisir_reglement_by_ciel');
frappe.saisir_reglement_by_ciel.SaisirReglementManager = SaisirReglementManager;
