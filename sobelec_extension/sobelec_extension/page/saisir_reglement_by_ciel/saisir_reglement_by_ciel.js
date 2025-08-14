frappe.pages['saisir_reglement_by_ciel'].on_page_load = function(wrapper) {
    frappe.ui.make_app_page({
        parent: wrapper,
        title: __('Saisir Règlement by Ciel'),
        single_column: true
    });

    let page_id = frappe.utils.get_random(5);
    $(frappe.render_template("saisir_reglement_by_ciel", { page_id: page_id }))
        .appendTo(wrapper);

    wrapper.reglement_manager = new SaisirReglementManager(wrapper, page_id);
};

// Vérifier si la classe existe déjà
if (!window.SaisirReglementManager) {
    window.SaisirReglementManager = class {
        constructor(wrapper, page_id) {
            this.wrapper = wrapper;
            this.page_id = page_id;
            this.selected_invoices = new Set();
            this.init();
        }

        async init() {
            await this.load_party_and_invoices();
            this.setup_payment_fields();
            this.bind_events();
        }

        async load_party_and_invoices() {
            const res = await frappe.call({
                method: "sobelec_extension.api_reglement.get_open_invoices_for_party"
            });

            this.party_type = res.message.party_type;
            this.party = res.message.party;
            this.render_invoices(res.message.invoices);
            this.update_balance(res.message.balance_info);
        }

        bind_events() {
            $(this.wrapper).on('change', '.invoice-checkbox', (e) => {
                const invoice_name = $(e.target).closest('tr').data('invoice-name');
                if (e.target.checked) this.selected_invoices.add(invoice_name);
                else this.selected_invoices.delete(invoice_name);
                this.update_totals();
            });
        }

        render_invoices(invoices) {
            const tbody = this.wrapper.querySelector('.invoices-table tbody');
            if (!invoices.length) {
                tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">${__("Aucune facture impayée")}</td></tr>`;
                return;
            }

            tbody.innerHTML = invoices.map(inv => `
                <tr data-invoice-name="${frappe.utils.escape_html(inv.name)}">
                    <td><input type="checkbox" class="invoice-checkbox"/></td>
                    <td>${frappe.utils.escape_html(inv.name)}</td>
                    <td>${frappe.datetime.str_to_user(inv.posting_date)}</td>
                    <td>${frappe.datetime.str_to_user(inv.due_date)}</td>
                    <td class="text-right">${format_currency(inv.grand_total)}</td>
                    <td class="text-right">${format_currency(inv.paid_amount)}</td>
                    <td class="text-right">${format_currency(inv.outstanding_amount)}</td>
                    <td>${frappe.utils.escape_html(inv.status)}</td>
                </tr>
            `).join('');
        }

        update_balance(balance_info) {
            this.wrapper.querySelector(`#total-balance-${this.page_id}`).textContent = balance_info.total_balance.toFixed(2);
            this.wrapper.querySelector(`#unpaid-count-${this.page_id}`).textContent = balance_info.unpaid_count;
            this.wrapper.querySelector(`#last-payment-${this.page_id}`).textContent = balance_info.last_payment_date || "-";
            this.wrapper.querySelector('.payment-amount').value = balance_info.total_balance.toFixed(2);
        }

        update_totals() {
            let total = 0;
            this.selected_invoices.forEach(name => {
                const row = this.wrapper.querySelector(`[data-invoice-name="${name}"]`);
                if (row) {
                    total += parseFloat(row.cells[6].textContent.replace(/[^0-9.-]+/g, "")) || 0;
                }
            });
            this.wrapper.querySelector(`#selected-balance-${this.page_id}`).textContent = total.toFixed(2);
            const payment_amount = this.wrapper.querySelector('.payment-amount');
            if (payment_amount) payment_amount.value = total.toFixed(2);
        }
    }
}
