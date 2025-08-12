frappe.pages['item-by-ciel'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Item by Ciel',
        single_column: true
    });

    // Nettoyer les instances précédentes
    if (frappe.item_by_ciel) {
        frappe.item_by_ciel.cleanup();
    }
    
    frappe.item_by_ciel = new ItemByCiel(page);
}

class ItemByCiel {
    constructor(page) {
        this.page = page;
        this.filters = {};
        this.items = [];
        this.offset = 0;
        this.limit = 50;
        this.loading = false;
        this.page_id = Math.random().toString(36).substr(2, 9); // ID unique pour éviter les conflits
        
        this.init();
    }

    init() {
        try {
            this.make_filters();
            this.make_toolbar();
            this.make_content();
            this.load_filter_options();
            this.load_items();
        } catch (error) {
            console.error('Erreur lors de l\'initialisation:', error);
            this.show_error('Erreur lors de l\'initialisation de la page');
        }
    }

    cleanup() {
        // Nettoyer les événements et les timers
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }
        
        // Supprimer les événements globaux
        $(document).off('click.item-ciel');
        
        // Vider le contenu de la page
        if (this.page && this.page.main) {
            this.page.main.empty();
        }
    }

    show_error(message) {
        frappe.msgprint({
            title: __('Erreur'),
            message: message,
            indicator: 'red'
        });
    }

    show_loading(show = true) {
        if (show) {
            $(`.loading-indicator-${this.page_id}`).show();
        } else {
            $(`.loading-indicator-${this.page_id}`).hide();
        }
    }	make_filters() {
		// Container pour les filtres style Frappe moderne
		this.filter_area = $(`
			<div class="item-ciel-filters">
				<div class="row">
					<div class="col-md-3">
						<div class="form-group">
							<label class="control-label">Recherche Code/Nom</label>
							                            <input type="text" class="form-control" id="search-input-${this.page_id}" placeholder="Tapez pour rechercher...">
						</div>
					</div>
					<div class="col-md-2">
						<div class="form-group">
							<label class="control-label">Groupe Article</label>
							                            <select class="form-control" id="item-group-filter-${this.page_id}">
								<option value="">Tous les groupes</option>
							</select>
						</div>
					</div>
					<div class="col-md-2">
						<div class="form-group">
							<label class="control-label">Entrepôt</label>
							                            <select class="form-control" id="warehouse-filter-${this.page_id}">
								<option value="">Tous les entrepôts</option>
							</select>
						</div>
					</div>
					<div class="col-md-2">
						<div class="form-group">
							<label class="control-label">Statut</label>
							                            <select class="form-control" id="status-filter-${this.page_id}">
								<option value="">Tous</option>
								<option value="active">Actifs</option>
								<option value="disabled">Désactivés</option>
								<option value="has_stock">Avec stock</option>
							</select>
						</div>
					</div>
					<div class="col-md-3">
						<div class="form-group">
							<label class="control-label">&nbsp;</label>
							<div class="btn-group d-block">
								<button class="btn btn-primary btn-sm" id="apply-filters-${this.page_id}">
									<i class="fa fa-search"></i> Rechercher
								</button>
								<button class="btn btn-default btn-sm" id="reset-filters-${this.page_id}">
									<i class="fa fa-refresh"></i> Reset
								</button>
								<button class="btn btn-success btn-sm" id="export-data-${this.page_id}">
									<i class="fa fa-download"></i> Export
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		`).appendTo(this.page.main);

		// Events
		this.setup_filter_events();
	}

	make_toolbar() {
		// Barre d'outils style Frappe
		this.page.set_primary_action(__('Nouvel Article'), () => {
			frappe.new_doc('Item');
		}, 'fa fa-plus');

		this.page.add_action_item(__('Actualiser'), () => {
			this.refresh_data();
		}, 'fa fa-refresh');

		this.page.add_action_item(__('Paramètres'), () => {
			this.show_settings();
		}, 'fa fa-cog');
	}

	make_content() {
		// Zone de contenu principal
		this.content_area = $(`
			<div class="item-ciel-content">
				<!-- Stats Summary -->
				<div class="stats-bar">
					<div class="row">
						<div class="col-md-3">
							<div class="stat-card">
								                                <div class="stat-number" id="total-items-${this.page_id}">0</div>
								<div class="stat-label">Articles</div>
							</div>
						</div>
						<div class="col-md-3">
							<div class="stat-card">
								                                <div class="stat-number" id="total-stock-${this.page_id}">0</div>
								<div class="stat-label">Stock Total</div>
							</div>
						</div>
						<div class="col-md-3">
							<div class="stat-card">
								                                <div class="stat-number" id="total-value-${this.page_id}">0</div>
								<div class="stat-label">Valeur Stock</div>
							</div>
						</div>
						<div class="col-md-3">
							<div class="stat-card">
								<div class="stat-number" id="items-count-${this.page_id}">0</div>
								<div class="stat-label">Affichés</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Table des articles -->
				<div class="items-table-container">
					<div class="table-responsive">
						<table class="table table-hover table-striped item-ciel-table">
							<thead class="table-header">
								<tr>
									<th width="100">Code</th>
									<th width="80">Image</th>
									<th width="300">Désignation</th>
									<th width="120">Groupe</th>
									<th width="100">Stock Réel</th>
									<th width="100">Stock Bloqué</th>
									<th width="120">Prix Vente HT</th>
									<th width="120">Prix Achat HT</th>
									<th width="80">Marge %</th>
									<th width="120">Fournisseur</th>
									<th width="100">Entrepôt</th>
									<th width="80">Actions</th>
								</tr>
							</thead>
							<tbody id="items-tbody-${this.page_id}">
							</tbody>
						</table>
					</div>
					
					<!-- Pagination -->
					<div class="pagination-area">
						<div class="row">
							<div class="col-md-6">
								<div class="pagination-info">
									                                    <span id="pagination-text-${this.page_id}">Affichage de 1 à 50 sur 0 articles</span>
								</div>
							</div>
							<div class="col-md-6 text-right">
								<div class="btn-group">
									<button class="btn btn-default btn-sm" id="prev-page-${this.page_id}" disabled>
										<i class="fa fa-chevron-left"></i> Précédent
									</button>
									<button class="btn btn-default btn-sm" id="next-page-${this.page_id}">
										Suivant <i class="fa fa-chevron-right"></i>
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Loading indicator -->
				<div class="loading-indicator text-center" style="display: none;">
					<i class="fa fa-spinner fa-spin fa-2x"></i>
					<p>Chargement en cours...</p>
				</div>
			</div>
		`).appendTo(this.page.main);

		this.setup_pagination();
	}

    setup_filter_events() {
        const self = this;
        
        // Recherche en temps réel avec délai - binding correct
        $(`#search-input-${this.page_id}`).on('input', function() {
            clearTimeout(self.searchTimeout);
            self.searchTimeout = setTimeout(() => {
                self.apply_filters();
            }, 500);
        });

        // Filtres select - binding correct  
        $(`#item-group-filter-${this.page_id}, #warehouse-filter-${this.page_id}, #status-filter-${this.page_id}`).on('change', function() {
            self.apply_filters();
        });

        // Boutons - binding correct
        $(`#apply-filters-${this.page_id}`).on('click', function() {
            self.apply_filters();
        });

        $(`#reset-filters-${this.page_id}`).on('click', function() {
            self.reset_filters();
        });

        $(`#export-data-${this.page_id}`).on('click', function() {
            self.export_data();
        });
    }	setup_pagination() {
		$(`#prev-page-${this.page_id}`).on('click', () => {
			if (this.offset > 0) {
				this.offset -= this.limit;
				this.load_items();
			}
		});

		$(`#next-page-${this.page_id}`).on('click', () => {
			this.offset += this.limit;
			this.load_items();
		});
	}

    load_filter_options() {
        frappe.call({
            method: 'sobelec_extension.item_by_ciel_api.get_filter_options',
            callback: (r) => {
                try {
                    if (r.message && r.message.success && r.message.data) {
                        // Peupler les selects avec IDs uniques
                        const itemGroups = $(`#item-group-filter-${this.page_id}`);
                        if (r.message.data.item_groups && Array.isArray(r.message.data.item_groups)) {
                            r.message.data.item_groups.forEach(group => {
                                itemGroups.append(`<option value="${group}">${group}</option>`);
                            });
                        }

                        const warehouses = $(`#warehouse-filter-${this.page_id}`);
                        if (r.message.data.warehouses && Array.isArray(r.message.data.warehouses)) {
                            r.message.data.warehouses.forEach(warehouse => {
                                warehouses.append(`<option value="${warehouse}">${warehouse}</option>`);
                            });
                        }
                    } else {
                        console.error('Erreur lors du chargement des filtres:', r.message);
                        this.show_error('Erreur lors du chargement des options de filtres');
                    }
                } catch (error) {
                    console.error('Erreur dans load_filter_options:', error);
                    this.show_error('Erreur lors du traitement des filtres');
                }
            },
            error: (err) => {
                console.error('Erreur réseau load_filter_options:', err);
                this.show_error('Erreur réseau lors du chargement des filtres');
            }
        });
    }	apply_filters() {
		this.filters = {
			item_code: $('#search-input').val(),
			item_name: $('#search-input').val(),
			item_group: $('#item-group-filter').val(),
			warehouse: $('#warehouse-filter').val()
		};

		const status = $('#status-filter').val();
		if (status === 'active') {
			this.filters.disabled = 0;
		} else if (status === 'disabled') {
			this.filters.disabled = 1;
		} else if (status === 'has_stock') {
			this.filters.has_stock = true;
		}

		this.offset = 0;
		this.load_items();
	}

    reset_filters() {
        try {
            $(`#search-input-${this.page_id}`).val('');
            $(`#item-group-filter-${this.page_id}`).val('');
            $(`#warehouse-filter-${this.page_id}`).val('');
            $(`#status-filter-${this.page_id}`).val('');
            this.filters = {};
            this.offset = 0;
            this.load_items();
        } catch (error) {
            console.error('Erreur dans reset_filters:', error);
            this.show_error('Erreur lors de la réinitialisation des filtres');
        }
    }	load_items() {
		if (this.loading) return;
		
		this.loading = true;
		$('.loading-indicator').show();
		$('#items-tbody').empty();

		frappe.call({
			method: 'sobelec_extension.item_by_ciel_api.get_items_ciel_style',
			args: {
				filters: this.filters,
				limit: this.limit,
				offset: this.offset
			},
			callback: (r) => {
				this.loading = false;
				$('.loading-indicator').hide();

				if (r.message && r.message.success) {
					this.items = r.message.data || [];
					this.render_items();
					
					// Calculer les stats à partir des données reçues
					const stats = this.calculate_stats(r.message);
					this.update_stats(stats);
					this.update_pagination(r.message.has_more);
				} else {
					frappe.msgprint({
						title: __('Erreur'),
						message: r.message?.error || __('Erreur lors du chargement'),
						indicator: 'red'
					});
				}
			}
		});
	}

    render_items() {
        try {
            const tbody = $(`#items-tbody-${this.page_id}`);
            tbody.empty();

            if (!this.items || !Array.isArray(this.items)) {
                tbody.append('<tr><td colspan="12" class="text-center text-muted">Aucun article trouvé</td></tr>');
                return;
            }

            this.items.forEach(item => {
                const row = this.create_item_row(item);
                tbody.append(row);
            });

            // Setup des events sur les nouvelles lignes
            this.setup_row_events();
        } catch (error) {
            console.error('Erreur dans render_items:', error);
            this.show_error('Erreur lors de l\'affichage des articles');
        }
    }	create_item_row(item) {
		// Déterminer les couleurs selon les règles business
		const stockClass = item.stock_reel > 0 ? 'text-success' : 'text-danger';
		const statusClass = item.disabled ? 'table-warning' : '';
		const margeClass = item.marge_pct > 20 ? 'text-success' : (item.marge_pct < 10 ? 'text-danger' : 'text-warning');

		// Image avec fallback
		const imageHtml = item.image ? 
			`<img src="${item.image}" class="item-thumbnail" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;">` :
			`<div class="item-thumbnail-placeholder" style="width: 50px; height: 50px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; display: flex; align-items: center; justify-content: center;">
				<i class="fa fa-image text-muted"></i>
			</div>`;

		return $(`
			<tr class="${statusClass}" data-item-code="${item.item_code}">
				<td>
					<strong>${item.item_code}</strong>
					${item.disabled ? '<span class="badge badge-danger">Désactivé</span>' : ''}
				</td>
				<td>${imageHtml}</td>
				<td>
					<div class="item-name">${item.item_name || ''}</div>
					<small class="text-muted">${item.description ? item.description.substring(0, 100) + '...' : ''}</small>
				</td>
				<td>${item.item_group || ''}</td>
				<td class="${stockClass}">
					<strong>${frappe.format(item.stock_reel || 0, {fieldtype: 'Float'})}</strong>
					<small class="d-block text-muted">${item.stock_uom || ''}</small>
				</td>
				<td class="text-warning">
					${frappe.format(item.stock_bloque || 0, {fieldtype: 'Float'})}
				</td>
				<td>
					<strong>${frappe.format(item.prix_vente_ht || 0, {fieldtype: 'Currency'})}</strong>
					<small class="d-block text-muted">${item.devise_vente || 'DA'}</small>
				</td>
				<td>
					${frappe.format(item.prix_achat_ht || item.last_purchase_rate || 0, {fieldtype: 'Currency'})}
					<small class="d-block text-muted">${item.devise_achat || 'DA'}</small>
				</td>
				<td class="${margeClass}">
					<strong>${item.marge_pct || 0}%</strong>
				</td>
				<td>
					<div class="supplier-info">
						<span>${item.nom_fournisseur || '-'}</span>
						${item.ref_fournisseur ? `<small class="d-block text-muted">Réf: ${item.ref_fournisseur}</small>` : ''}
					</div>
				</td>
				<td>${item.emplacement || ''}</td>
				<td>
					<div class="btn-group-vertical">
						<button class="btn btn-xs btn-default item-details-btn" title="Détails">
							<i class="fa fa-info-circle"></i>
						</button>
						<button class="btn btn-xs btn-primary item-edit-btn" title="Modifier">
							<i class="fa fa-edit"></i>
						</button>
						<button class="btn btn-xs btn-success item-stock-btn" title="Stock">
							<i class="fa fa-cube"></i>
						</button>
					</div>
				</td>
			</tr>
		`);
	}

    setup_row_events() {
        const self = this;
        
        // Utiliser la délégation d'événements pour éviter les problèmes de binding
        // Double-clic pour ouvrir l'article
        $(`#items-tbody-${this.page_id}`).off('dblclick.item-ciel').on('dblclick.item-ciel', 'tr', function() {
            const itemCode = $(this).data('item-code');
            if (itemCode) {
                frappe.set_route('Form', 'Item', itemCode);
            }
        });

        // Boutons d'action avec délégation
        $(`#items-tbody-${this.page_id}`).off('click.item-details').on('click.item-details', '.item-details-btn', function(e) {
            e.stopPropagation();
            const itemCode = $(this).closest('tr').data('item-code');
            if (itemCode) {
                self.show_item_details(itemCode);
            }
        });

        $(`#items-tbody-${this.page_id}`).off('click.item-edit').on('click.item-edit', '.item-edit-btn', function(e) {
            e.stopPropagation();
            const itemCode = $(this).closest('tr').data('item-code');
            if (itemCode) {
                frappe.set_route('Form', 'Item', itemCode);
            }
        });

        $(`#items-tbody-${this.page_id}`).off('click.item-stock').on('click.item-stock', '.item-stock-btn', function(e) {
            e.stopPropagation();
            const itemCode = $(this).closest('tr').data('item-code');
            if (itemCode) {
                self.show_stock_details(itemCode);
            }
        });
    }	calculate_stats(response_data) {
		const items = response_data.data || [];
		
		let total_stock = 0;
		let total_value = 0;
		
		items.forEach(item => {
			total_stock += (item.stock_reel || 0);
			total_value += (item.valeur_stock || 0);
		});
		
		return {
			total_items: response_data.total || 0,
			total_stock: total_stock,
			total_valeur: total_value,
			items_displayed: items.length
		};
	}

    update_stats(totals) {
        try {
            $(`#total-items-${this.page_id}`).text(frappe.format(totals.total_items || 0, {fieldtype: 'Int'}));
            $(`#total-stock-${this.page_id}`).text(frappe.format(totals.total_stock || 0, {fieldtype: 'Float'}));
            $(`#total-value-${this.page_id}`).text(frappe.format(totals.total_valeur || 0, {fieldtype: 'Currency'}));
            $(`#items-count-${this.page_id}`).text(totals.items_displayed || 0);
        } catch (error) {
            console.error('Erreur dans update_stats:', error);
        }
    }	update_pagination(hasMore) {
		const start = this.offset + 1;
		const end = this.offset + this.items.length;
		$('#pagination-text').text(`Affichage de ${start} à ${end} articles`);

		$(`#prev-page-${this.page_id}`).prop('disabled', this.offset === 0);
		$(`#next-page-${this.page_id}`).prop('disabled', !hasMore);
	}

	show_item_details(itemCode) {
		// Utiliser l'API existante pour les détails
		frappe.call({
			method: 'sobelec_extension.item_details_api.get_item_complete_details',
			args: { item_code: itemCode },
			callback: (r) => {
				console.log("Réponse API reçue pour:", itemCode, r);
				if (r.message && r.message.success) {
					// Réutiliser la modal existante mais en mode simplifié
					this.render_details_modal(r.message.data);
				}
			}
		});
	}

	show_stock_details(itemCode) {
		frappe.call({
			method: 'sobelec_extension.item_stock_details_api.get_item_stock_details',
			args: { item_code: itemCode },
			callback: (r) => {
				if (r.message && r.message.success) {
					this.render_stock_modal(itemCode, r.message.data);
				} else {
					frappe.msgprint({
						title: __('Erreur'),
						message: r.message?.error || __('Impossible de récupérer les détails de stock'),
						indicator: 'red'
					});
				}
			}
		});
	}

	render_details_modal(data) {
		// Modal moderne style Frappe
		const modal = new frappe.ui.Dialog({
			title: `${data.item_code} - ${data.item_name}`,
			fields: [
				{
					fieldtype: 'HTML',
					fieldname: 'item_details',
					options: this.build_details_html(data)
				}
			],
			size: 'large'
		});

		modal.show();
	}

	render_stock_modal(itemCode, stockData) {
		const stockHtml = `
			<div class="stock-details">
				<h5>Détail du stock par entrepôt</h5>
				<table class="table table-sm table-bordered">
					<thead>
						<tr>
							<th>Entrepôt</th>
							<th>Stock Réel</th>
							<th>Stock Réservé</th>
							<th>Stock Projeté</th>
							<th>Valeur</th>
						</tr>
					</thead>
					<tbody>
						${stockData.map(stock => `
							<tr>
								<td><strong>${stock.warehouse}</strong></td>
								<td class="${stock.actual_qty > 0 ? 'text-success' : 'text-danger'}">
									${frappe.format(stock.actual_qty || 0, {fieldtype: 'Float'})}
								</td>
								<td>${frappe.format(stock.reserved_qty || 0, {fieldtype: 'Float'})}</td>
								<td>${frappe.format(stock.projected_qty || 0, {fieldtype: 'Float'})}</td>
								<td>${frappe.format(stock.stock_value || 0, {fieldtype: 'Currency'})}</td>
							</tr>
						`).join('')}
					</tbody>
				</table>
			</div>
		`;

		const modal = new frappe.ui.Dialog({
			title: `Stock - ${itemCode}`,
			fields: [
				{
					fieldtype: 'HTML',
					fieldname: 'stock_details',
					options: stockHtml
				}
			],
			size: 'large'
		});

		modal.show();
	}

	build_details_html(data) {
		return `
			<div class="row">
				<div class="col-md-6">
					${data.image ? `<img src="${data.image}" style="max-width: 100%; max-height: 200px; object-fit: cover; border-radius: 8px; margin-bottom: 15px;">` : ''}
					<table class="table table-sm">
						<tr><td><strong>Code:</strong></td><td>${data.item_code}</td></tr>
						<tr><td><strong>Nom:</strong></td><td>${data.item_name || ''}</td></tr>
						<tr><td><strong>Groupe:</strong></td><td>${data.item_group || ''}</td></tr>
						<tr><td><strong>Marque:</strong></td><td>${data.brand || ''}</td></tr>
						<tr><td><strong>UOM:</strong></td><td>${data.stock_uom || ''}</td></tr>
					</table>
				</div>
				<div class="col-md-6">
					<h6>Stock & Prix</h6>
					<table class="table table-sm">
						<tr><td><strong>Stock Total:</strong></td><td class="text-success">${data.stock_total || 0}</td></tr>
						<tr><td><strong>Prix Standard:</strong></td><td>${frappe.format(data.standard_rate || 0, {fieldtype: 'Currency'})}</td></tr>
						<tr><td><strong>Dernier Prix Achat:</strong></td><td>${frappe.format(data.last_purchase_rate || 0, {fieldtype: 'Currency'})}</td></tr>
						<tr><td><strong>Taux Évaluation:</strong></td><td>${frappe.format(data.valuation_rate || 0, {fieldtype: 'Currency'})}</td></tr>
					</table>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<h6>Description</h6>
					<p>${data.description || 'Aucune description'}</p>
				</div>
			</div>
		`;
	}

	export_data() {
		frappe.call({
			method: 'sobelec_extension.item_by_ciel_api.export_items_ciel',
			args: { filters: this.filters },
			callback: (r) => {
				if (r.message && r.message.success) {
					frappe.msgprint({
						title: __('Export réussi'),
						message: __('Les données ont été exportées avec succès'),
						indicator: 'green'
					});
					
					// Télécharger le fichier
					this.download_csv(r.message.data, r.message.filename);
				}
			}
		});
	}

	download_csv(data, filename) {
		// Conversion en CSV et téléchargement
		const csvContent = this.convert_to_csv(data);
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const link = document.createElement("a");
		
		if (link.download !== undefined) {
			const url = URL.createObjectURL(blob);
			link.setAttribute("href", url);
			link.setAttribute("download", filename);
			link.style.visibility = 'hidden';
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		}
	}

	convert_to_csv(data) {
		const headers = [
			'Code', 'Nom', 'Groupe', 'Stock Réel', 'Stock Bloqué',
			'Prix Vente HT', 'Prix Achat HT', 'Marge %', 'Fournisseur', 'Entrepôt'
		];
		
		let csv = headers.join(',') + '\n';
		
		data.forEach(item => {
			const row = [
				item.item_code || '',
				`"${(item.item_name || '').replace(/"/g, '""')}"`,
				item.item_group || '',
				item.stock_reel || 0,
				item.stock_bloque || 0,
				item.prix_vente_ht || 0,
				item.prix_achat_ht || 0,
				item.marge_pct || 0,
				`"${(item.nom_fournisseur || '').replace(/"/g, '""')}"`,
				item.emplacement || ''
			];
			csv += row.join(',') + '\n';
		});
		
		return csv;
	}

	refresh_data() {
		this.offset = 0;
		this.load_items();
		frappe.show_alert({
			message: __('Données actualisées'),
			indicator: 'green'
		});
	}

	show_settings() {
		// Modal pour les paramètres
		const modal = new frappe.ui.Dialog({
			title: __('Paramètres'),
			fields: [
				{
					fieldtype: 'Section Break',
					label: __('Affichage')
				},
				{
					fieldtype: 'Int',
					fieldname: 'items_per_page',
					label: __('Articles par page'),
					default: this.limit
				},
				{
					fieldtype: 'Check',
					fieldname: 'auto_refresh',
					label: __('Actualisation automatique')
				}
			],
			primary_action_label: __('Sauvegarder'),
			primary_action: (values) => {
				this.limit = values.items_per_page || 50;
				this.offset = 0;
				this.load_items();
				modal.hide();
				frappe.show_alert({
					message: __('Paramètres sauvegardés'),
					indicator: 'green'
				});
			}
		});

		modal.show();
	}
}
