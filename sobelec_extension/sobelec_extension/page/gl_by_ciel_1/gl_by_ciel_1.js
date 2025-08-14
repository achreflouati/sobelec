frappe.pages['gl-by-ciel-1'].on_page_load = function(wrapper) {
    let $parent = $(wrapper);
    $parent.empty();

    frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Grand Livre - style Ciel (Amélioré)',
        single_column: true
    });

    // local state (pagination, sorting, cache)
    let state = { limit: 50, offset: 0, sort_by: '', sort_order: 'asc', total_count: 0, last_filters: {}, last_rows: [] };

    function enhanceUI() {
        // add company select before account
        const $journal = $parent.find('.filter-journal');
        if ($journal.length && !$parent.find('.filter-company').length) {
            $journal.before('<label style="margin-right:6px;margin-left:6px;">Société :</label><select class="form-control filter-company" style="min-width:200px;"><option value=""></option></select>');
        }
        // include opening row checkbox
        const $btnSearch = $parent.find('.btn-search');
        if ($btnSearch.length && !$parent.find('.filter-include-opening').length) {
            $btnSearch.before('<label style="margin-left:16px;margin-right:6px;"><input type="checkbox" class="filter-include-opening"> Solde d\'ouverture</label>');
        }
        // actions/pagination toolbar
        if (!$parent.find('.gl-actions').length) {
            const toolbar = $(
                '<div class="gl-actions" style="margin:8px 0; display:flex; gap:8px; align-items:center;">' +
                '<button class="btn btn-secondary btn-add-entry">Ajouter écriture</button>' +
                '<button class="btn btn-default btn-export">Export CSV</button>' +
                '<div style="margin-left:auto; display:flex; gap:8px; align-items:center;">' +
                '<button class="btn btn-default btn-prev">Précédent</button>' +
                '<span class="page-info">Page 1</span>' +
                '<button class="btn btn-default btn-next">Suivant</button>' +
                '</div>' +
                '</div>'
            );
            $parent.find('.filters-section').length ? $parent.find('.filters-section').after(toolbar) : $btnSearch.closest('div').after(toolbar);
        }
        // add Actions column
        const $theadRow = $parent.find('.gl-table thead tr');
        if ($theadRow.length && $theadRow.find('th').last().text().trim() !== 'Actions') {
            $theadRow.append('<th>Actions</th>');
        }
        const $tfootRow = $parent.find('.gl-table tfoot tr');
        if ($tfootRow.length && $tfootRow.find('th').length === 7) {
            $tfootRow.append('<th></th>');
        }
    }

    // Inject the page template compiled by Frappe (fallback-safe)
    try {
        let html = "";
        try {
            html = frappe.render_template("gl_by_ciel_1", {});
        } catch (e1) {
            try {
                // try with full path as a fallback (depends on build)
                html = frappe.render_template(
                    "sobelec_extension/sobelec_extension/sobelec_extension/page/gl_by_ciel_1/gl_by_ciel_1.html",
                    {}
                );
            } catch (e2) {
                html = "";
            }
        }
        if (html) {
            $parent.find('.layout-main-section').html(html);
        } else {
            // load from public assets as a last resort
            $.get('/assets/sobelec_extension/html/gl_by_ciel_1.html')
                .done(function(data){
                    $parent.find('.layout-main-section').html(data);
                })
                .fail(function(){ /* leave default */ });
        }
    } catch (e) {
        // If template cannot be rendered, keep default page content
        // This avoids blank page issues when the selector doesn't exist
    }

    enhanceUI();
    loadFilters();
    bindEvents();

    function loadFilters() {
        frappe.call({
            method: "sobelec_extension.api_gl.get_gl_filter_options",
            callback: function(r) {
                if (!r.exc && r.message && r.message.success) {
                    let $journal = $parent.find('.filter-journal');
                    $journal.empty().append('<option value=""></option>');
                    r.message.data.accounts.forEach(acc => {
                        $journal.append(`<option value="${acc.name}">${acc.account_name}</option>`);
                    });
                    let $company = $parent.find('.filter-company');
                    if ($company.length) {
                        $company.empty().append('<option value=""></option>');
                        (r.message.data.companies || []).forEach(c => {
                            $company.append(`<option value="${c.name}">${c.company_name || c.name}</option>`);
                        });
                    }
                }
            }
        });
    }

    function bindEvents() {
        $parent.find('.btn-search').on('click', function() {
            state.offset = 0;
            searchEntries();
        });
        // trigger search on Enter in any filter
        $parent.on('keydown', '.filter-company, .filter-journal, .filter-from-date, .filter-to-date, .filter-libelle, .filter-piece', function(e){
            if (e.key === 'Enter') {
                e.preventDefault();
                state.offset = 0;
                searchEntries();
            }
        });
        // company change -> reload accounts
        $parent.on('change', '.filter-company', function(){
            const company = $(this).val();
            frappe.call({
                method: 'sobelec_extension.api_gl.get_accounts_by_company',
                args: { company },
                callback: function(r){
                    if (!r.exc && r.message && r.message.success) {
                        let $j = $parent.find('.filter-journal');
                        $j.empty().append('<option value=""></option>');
                        (r.message.data || []).forEach(acc => {
                            $j.append(`<option value="${acc.name}">${acc.account_name}</option>`);
                        });
                    }
                }
            });
        });
        // sorting by header click
        $parent.on('click', '.gl-table thead th', function(){
            const label = ($(this).text() || '').trim();
            let col = null;
            if (label.startsWith('Compte')) col = 'account';
            else if (label.startsWith('Date')) col = 'posting_date';
            else return;
            if (state.sort_by === col) {
                state.sort_order = state.sort_order === 'asc' ? 'desc' : 'asc';
            } else {
                state.sort_by = col;
                state.sort_order = 'asc';
            }
            state.offset = 0;
            searchEntries();
        });
        // pagination
        $parent.on('click', '.btn-prev', function(){
            if (state.offset <= 0) return;
            state.offset = Math.max(0, state.offset - state.limit);
            searchEntries();
        });
        $parent.on('click', '.btn-next', function(){
            const next = state.offset + state.limit;
            if (state.total_count && next >= state.total_count) return;
            state.offset = next;
            searchEntries();
        });
        // add entry
        $parent.on('click', '.btn-add-entry', function(){
            frappe.new_doc('Journal Entry');
        });
        // export CSV
        $parent.on('click', '.btn-export', function(){
            exportCSV(state.last_rows || []);
        });
        // open voucher
        $parent.on('click', '.btn-open', function(e){
            e.preventDefault();
            const type = $(this).data('type');
            const name = $(this).data('name');
            if (type && name) frappe.set_route('Form', type, name);
        });
        // unpaid invoices
        $parent.on('click', '.btn-unpaid', function(e){
            e.preventDefault();
            const company = $(this).data('company');
            const ptype = $(this).data('ptype');
            const party = $(this).data('party');
            showUnpaid(company, ptype, party);
        });
    }

    function searchEntries() {
        const from_date = $parent.find('.filter-from-date').val() || $parent.find('.filter-date').val() || "";
        const to_date = $parent.find('.filter-to-date').val() || "";

        let filters = {
            company: $parent.find('.filter-company').val(),
            account: $parent.find('.filter-journal').val(),
            from_date,
            to_date,
            voucher_no: $parent.find('.filter-piece').val(),
            search_text: $parent.find('.filter-libelle').val(),
            include_opening_row: $parent.find('.filter-include-opening').is(':checked') ? 1 : 0,
            exclude_cancelled: 1,
            limit: state.limit,
            offset: state.offset,
            sort_by: state.sort_by,
            sort_order: state.sort_order
        };

        frappe.call({
            method: "sobelec_extension.api_gl.search_gl_entries",
            args: filters,
            callback: function(r) {
                if (!r.exc && r.message && r.message.success) {
                    state.total_count = r.message.data.total_count || 0;
                    state.last_filters = filters;
                    state.last_rows = r.message.data.entries || [];
                    renderTable(state.last_rows);
                    renderTotals(r.message.data.totals || {});
                    updatePageInfo();
                }
            }
        });
    }

    function renderTable(rows) {
        let $tbody = $parent.find('.gl-table tbody');
        $tbody.empty();

        if (!rows || !rows.length) {
            $tbody.append('<tr><td colspan="7" class="text-center text-muted">Aucune écriture trouvée</td></tr>');
            return;
        }

        const fmt = (n) => Number(n || 0).toFixed(2);

        rows.forEach(row => {
            const date = row.posting_date ? frappe.datetime.str_to_user(row.posting_date) : '';
            const actions = `
                ${(row.voucher_type && row.voucher_no) ? `<a href="#" class="btn btn-xs btn-link btn-open" data-type="${row.voucher_type}" data-name="${row.voucher_no}">Pièce</a>` : ''}
                ${((row.party_type === 'Customer' || row.party_type === 'Supplier') && row.party) ? `<a href="#" class="btn btn-xs btn-link btn-unpaid" data-company="${row.company || ''}" data-ptype="${row.party_type}" data-party="${row.party}">Impayés</a>` : ''}
            `;
            $tbody.append(`
                <tr>
                    <td>${row.account || ''}</td>
                    <td>${row.remarks || ''}</td>
                    <td class="text-right">${fmt(row.debit)}</td>
                    <td class="text-right">${fmt(row.credit)}</td>
                    <td>${date}</td>
                    <td>${row.against || ''}</td>
                    <td class="text-right">${fmt(row.running_balance)}</td>
                    <td>${actions}</td>
                </tr>
            `);
        });
    }

    function renderTotals(totals) {
        $parent.find('.total-debit').text(Number(totals.debit || 0).toFixed(2));
        $parent.find('.total-credit').text(Number(totals.credit || 0).toFixed(2));
        $parent.find('.total-balance').text(Number(totals.closing_balance || 0).toFixed(2));
        // show opening balance in the blank footer cell
        const cells = $parent.find('.gl-table tfoot tr th');
        if (cells && cells.length >= 5) {
            $(cells[3]).html('Solde ouv: <span class="total-opening">' + Number(totals.opening_balance || 0).toFixed(2) + '</span>');
        }
    }

    function updatePageInfo() {
        const page = Math.floor(state.offset / state.limit) + 1;
        const pages = state.total_count ? Math.max(1, Math.ceil(state.total_count / state.limit)) : page;
        $parent.find('.page-info').text(`Page ${page} / ${pages}`);
    }

    function exportCSV(rows) {
        if (!rows || !rows.length) {
            frappe.show_alert({ message: 'Aucune donnée à exporter', indicator: 'orange' });
            return;
        }
        const head = ['Compte','Libellé','Débit','Crédit','Date','Contrepartie','Solde courant','Pièce','Type'];
        const lines = [head.join(',')];
        const esc = (v) => {
            const s = (v==null?'' : String(v));
            return '"' + s.replace(/"/g, '""') + '"';
        };
        rows.forEach(r => {
            const date = r.posting_date ? frappe.datetime.str_to_user(r.posting_date) : '';
            lines.push([
                esc(r.account||''), esc(r.remarks||''), Number(r.debit||0).toFixed(2), Number(r.credit||0).toFixed(2), esc(date), esc(r.against||''), Number(r.running_balance||0).toFixed(2), esc(r.voucher_no||''), esc(r.voucher_type||'')
            ].join(','));
        });
        const blob = new Blob([lines.join('\n')], {type: 'text/csv;charset=utf-8;'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'grand_livre.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function showUnpaid(company, party_type, party) {
        if (!party_type || !party) return;
        frappe.call({
            method: 'sobelec_extension.api_gl.get_unpaid_invoices',
            args: { company, party_type, party, limit: 100, offset: 0 },
            callback: function(r){
                if (r.exc || !r.message || !r.message.success) return;
                const list = (r.message.data && r.message.data.invoices) || [];
                const d = new frappe.ui.Dialog({
                    title: `Impayés - ${party}`,
                    size: 'large',
                    fields: [{ fieldtype: 'HTML', fieldname: 'html' }]
                });
                let html = '<div class="table-responsive"><table class="table table-bordered table-sm"><thead><tr><th>Facture</th><th>Date</th><th>Échéance</th><th class="text-right">Total</th><th class="text-right">À payer</th></tr></thead><tbody>';
                list.forEach(inv => {
                    const date = inv.posting_date ? frappe.datetime.str_to_user(inv.posting_date) : '';
                    const due = inv.due_date ? frappe.datetime.str_to_user(inv.due_date) : '';
                    html += `<tr>` +
                            `<td><a href="#" data-doctype="${party_type==='Customer'?'Sales Invoice':'Purchase Invoice'}" data-name="${inv.name}" class="open-invoice">${inv.name}</a></td>` +
                            `<td>${date}</td>` +
                            `<td>${due}</td>` +
                            `<td class="text-right">${Number(inv.grand_total||0).toFixed(2)} ${inv.currency||''}</td>` +
                            `<td class="text-right">${Number(inv.outstanding_amount||0).toFixed(2)} ${inv.currency||''}</td>` +
                            `</tr>`;
                });
                html += '</tbody></table></div>';
                d.get_field('html').$wrapper.html(html);
                d.$wrapper.on('click', '.open-invoice', function(e){
                    e.preventDefault();
                    const dt = $(this).data('doctype');
                    const dn = $(this).data('name');
                    if (dt && dn) frappe.set_route('Form', dt, dn);
                });
                d.show();
            }
        });
    }
};
