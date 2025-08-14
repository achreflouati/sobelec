frappe.pages['gl-by-ciel-1'].on_page_load = function(wrapper) {
    let $parent = $(wrapper);
    $parent.empty();

    frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Grand Livre - style Ciel',
        single_column: true
    });

    // Charger le HTML depuis public/html
    $.get('/assets/sobelec_extension/html/gl_by_ciel_1.html', function(data) {
        $parent.find('.layout-main-section').html(data);

        loadFilters();
        bindEvents();
    });

    function loadFilters() {
        frappe.call({
            method: "sobelec_extension.api_gl.get_gl_filter_options",
            callback: function(r) {
                if (!r.exc && r.message && r.message.success) {
                    let $journal = $parent.find('.filter-journal');
                    r.message.data.accounts.forEach(acc => {
                        $journal.append(`<option value="${acc.name}">${acc.account_name}</option>`);
                    });
                }
            }
        });
    }

    function bindEvents() {
        $parent.find('.btn-search').on('click', function() {
            searchEntries();
        });
    }

    function searchEntries() {
        let filters = {
            account: $parent.find('.filter-journal').val(),
            from_date: $parent.find('.filter-from-date').val(),
            to_date: $parent.find('.filter-to-date').val(),
            search_text: $parent.find('.filter-libelle').val(),
            voucher_no: $parent.find('.filter-piece').val(),
            limit: 50,
            offset: 0
        };

        frappe.call({
            method: "sobelec_extension.api_gl.search_gl_entries",
            args: filters,
            callback: function(r) {
                if (!r.exc && r.message && r.message.success) {
                    renderTable(r.message.data.entries);
                    renderTotals(r.message.data.totals);
                }
            }
        });
    }

    function renderTable(rows) {
        let $tbody = $parent.find('.gl-table tbody');
        $tbody.empty();

        rows.forEach(row => {
            $tbody.append(`
                <tr>
                    <td>${row.account}</td>
                    <td>${row.remarks || ''}</td>
                    <td class="text-right">${Number(row.debit || 0).toFixed(2)}</td>
                    <td class="text-right">${Number(row.credit || 0).toFixed(2)}</td>
                    <td>${row.posting_date || ''}</td>
                    <td>${row.against || ''}</td>
                    <td class="text-right">${Number(row.running_balance || 0).toFixed(2)}</td>
                </tr>
            `);
        });
    }

    function renderTotals(totals) {
        $parent.find('.total-debit').text(Number(totals.debit || 0).toFixed(2));
        $parent.find('.total-credit').text(Number(totals.credit || 0).toFixed(2));
        $parent.find('.total-balance').text(Number(totals.closing_balance || 0).toFixed(2));
    }
};
