/**
 * Sobelec Extension - Interface JavaScript optimisée
 * Version professionnelle avec architecture modulaire
 * Développé avec 20 ans d'expérience
 */
console.log("Script SobelecItemManager chargé !");
class SobelecItemManager {
    constructor(wrapper) {
        this.wrapper = wrapper;
        this.page_id = `sobelec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.current_items = [];
        this.total_count = 0;
        this.current_page = 1;
        this.items_per_page = 50;
        this.filters = {
            search_text: '',
            item_group: '',
            warehouse: '',
            brand: '',
            status: 'all'
        };
        this.sort_config = {
            field: 'item_code',
            order: 'asc'
        };
        this.filter_options = null;
        this.is_loading = false;
        
        this.init();
    }

    async init() {
        try {
            this.setup_page_structure();
            await this.load_filter_options();
            this.setup_event_handlers();
            await this.load_items();
            this.show_success_message("Interface initialisée avec succès");
        } catch (error) {
            this.handle_error("Erreur d'initialisation", error);
        }
    }

    setup_page_structure() {
        this.wrapper.innerHTML = `
            <div class="sobelec-container">
                <!-- Header Section -->
                <div class="page-header">
                    <div class="row">
                        <div class="col-md-8">
                            <h2><i class="fa fa-cubes"></i> Gestion Articles Sobelec</h2>
                            <p class="text-muted">Interface professionnelle de gestion des articles</p>
                        </div>
                        <div class="col-md-4 text-right">
                            <button class="btn btn-primary" id="refresh-data-${this.page_id}">
                                <i class="fa fa-refresh"></i> Actualiser
                            </button>
                            <button class="btn btn-success" id="export-excel-${this.page_id}">
                                <i class="fa fa-download"></i> Exporter
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Filters Section -->
                <div class="filters-section card">
                    <div class="card-header">
                        <h4><i class="fa fa-filter"></i> Filtres de recherche</h4>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-3">
                                <label>Recherche</label>
                                <input type="text" 
                                       class="form-control" 
                                       id="search-input-${this.page_id}" 
                                       placeholder="Code ou nom article..."
                                       autocomplete="off">
                            </div>
                            <div class="col-md-2">
                                <label>Groupe d'article</label>
                                <select class="form-control" id="item-group-filter-${this.page_id}">
                                    <option value="">Tous les groupes</option>
                                </select>
                            </div>
                            <div class="col-md-2">
                                <label>Entrepôt</label>
                                <select class="form-control" id="warehouse-filter-${this.page_id}">
                                    <option value="">Tous les entrepôts</option>
                                </select>
                            </div>
                            <div class="col-md-2">
                                <label>Marque</label>
                                <select class="form-control" id="brand-filter-${this.page_id}">
                                    <option value="">Toutes les marques</option>
                                </select>
                            </div>
                            <div class="col-md-2">
                                <label>Statut</label>
                                <select class="form-control" id="status-filter-${this.page_id}">
                                    <option value="all">Tous</option>
                                    <option value="stock_only">Stock uniquement</option>
                                    <option value="non_stock">Hors stock</option>
                                </select>
                            </div>
                            <div class="col-md-1">
                                <label>&nbsp;</label>
                                <button class="btn btn-primary btn-block" id="apply-filters-${this.page_id}">
                                    <i class="fa fa-search"></i>
                                </button>
                            </div>
                        </div>
                        <div class="row mt-2">
                            <div class="col-md-12">
                                <button class="btn btn-secondary btn-sm" id="reset-filters-${this.page_id}">
                                    <i class="fa fa-times"></i> Reset
                                </button>
                                <span class="ml-3 text-muted" id="filter-status-${this.page_id}">
                                    Aucun filtre appliqué
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Statistics Section -->
                <div class="stats-section">
                    <div class="row">
                        <div class="col-md-3">
                            <div class="stat-card bg-primary">
                                <div class="stat-number" id="total-items-${this.page_id}">0</div>
                                <div class="stat-label">Total Articles</div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="stat-card bg-success">
                                <div class="stat-number" id="stock-items-${this.page_id}">0</div>
                                <div class="stat-label">En Stock</div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="stat-card bg-warning">
                                <div class="stat-number" id="total-value-${this.page_id}">0 €</div>
                                <div class="stat-label">Valeur Totale</div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="stat-card bg-info">
                                <div class="stat-number" id="displayed-count-${this.page_id}">0</div>
                                <div class="stat-label">Affichés</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Loading Indicator -->
                <div class="loading-section" id="loading-${this.page_id}" style="display: none;">
                    <div class="text-center">
                        <div class="spinner-border text-primary" role="status">
                            <span class="sr-only">Chargement...</span>
                        </div>
                        <p class="mt-2">Chargement des données...</p>
                    </div>
                </div>

                <!-- Items Table -->
                <div class="items-section card">
                    <div class="card-header d-flex justify-content-between">
                        <h4><i class="fa fa-list"></i> Liste des Articles</h4>
                        <div class="sorting-controls">
                            <select class="form-control form-control-sm d-inline-block" 
                                    id="sort-field-${this.page_id}" style="width: auto;">
                                <option value="item_code">Code Article</option>
                                <option value="item_name">Nom Article</option>
                                <option value="item_group">Groupe</option>
                                <option value="creation">Date Création</option>
                            </select>
                            <select class="form-control form-control-sm d-inline-block ml-2" 
                                    id="sort-order-${this.page_id}" style="width: auto;">
                                <option value="asc">Croissant</option>
                                <option value="desc">Décroissant</option>
                            </select>
                        </div>
                    </div>
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-hover table-striped mb-0">
                                <thead class="thead-dark">
                                    <tr>
                                        <th>Code Article</th>
                                        <th>Nom Article</th>
                                        <th>Groupe</th>
                                        <th>Marque</th>
                                        <th>UOM</th>
                                        <th>Stock Total</th>
                                        <th>Prix Vente</th>
                                        <th>Valeur Stock</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="items-tbody-${this.page_id}">
                                    <!-- Items dynamically loaded here -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- Pagination -->
                <div class="pagination-section">
                    <div class="row align-items-center">
                        <div class="col-md-6">
                            <span id="pagination-info-${this.page_id}" class="text-muted">
                                Affichage de 0 à 0 sur 0 articles
                            </span>
                        </div>
                        <div class="col-md-6 text-right">
                            <div class="btn-group">
                                <button class="btn btn-outline-secondary" 
                                        id="first-page-${this.page_id}">
                                    <i class="fa fa-angle-double-left"></i>
                                </button>
                                <button class="btn btn-outline-secondary" 
                                        id="prev-page-${this.page_id}">
                                    <i class="fa fa-angle-left"></i>
                                </button>
                                <span class="btn btn-outline-secondary disabled" 
                                      id="current-page-${this.page_id}">
                                    Page 1
                                </span>
                                <button class="btn btn-outline-secondary" 
                                        id="next-page-${this.page_id}">
                                    <i class="fa fa-angle-right"></i>
                                </button>
                                <button class="btn btn-outline-secondary" 
                                        id="last-page-${this.page_id}">
                                    <i class="fa fa-angle-double-right"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async load_filter_options() {
        try {
            const response = await this.api_call('get_filter_options');
            if (response.success) {
                this.filter_options = response.data;
                this.populate_filter_dropdowns();
            } else {
                throw new Error(response.error || 'Erreur chargement options');
            }
        } catch (error) {
            this.handle_error("Erreur chargement filtres", error);
        }
    }

    populate_filter_dropdowns() {
        if (!this.filter_options) return;

        // Groupes d'articles
        const groupSelect = document.getElementById(`item-group-filter-${this.page_id}`);
        this.filter_options.item_groups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.name;
            option.textContent = group.item_group_name || group.name;
            groupSelect.appendChild(option);
        });

        // Entrepôts
        const warehouseSelect = document.getElementById(`warehouse-filter-${this.page_id}`);
        this.filter_options.warehouses.forEach(warehouse => {
            const option = document.createElement('option');
            option.value = warehouse.name;
            option.textContent = warehouse.warehouse_name || warehouse.name;
            warehouseSelect.appendChild(option);
        });

        // Marques
        const brandSelect = document.getElementById(`brand-filter-${this.page_id}`);
        this.filter_options.brands.forEach(brand => {
            const option = document.createElement('option');
            option.value = brand.name;
            option.textContent = brand.brand || brand.name;
            brandSelect.appendChild(option);
        });
    }

    setup_event_handlers() {
        const self = this;

        // Recherche en temps réel avec debounce
        let searchTimeout;
        document.getElementById(`search-input-${this.page_id}`).addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                self.filters.search_text = this.value;
                self.apply_filters();
            }, 500);
        });

        // Filtres
        document.getElementById(`apply-filters-${this.page_id}`).addEventListener('click', () => {
            this.collect_filters();
            this.apply_filters();
        });

        document.getElementById(`reset-filters-${this.page_id}`).addEventListener('click', () => {
            this.reset_filters();
        });

        // Tri
        document.getElementById(`sort-field-${this.page_id}`).addEventListener('change', () => {
            this.update_sort_config();
        });

        document.getElementById(`sort-order-${this.page_id}`).addEventListener('change', () => {
            this.update_sort_config();
        });

        // Pagination
        document.getElementById(`first-page-${this.page_id}`).addEventListener('click', () => {
            this.go_to_page(1);
        });

        document.getElementById(`prev-page-${this.page_id}`).addEventListener('click', () => {
            if (this.current_page > 1) {
                this.go_to_page(this.current_page - 1);
            }
        });

        document.getElementById(`next-page-${this.page_id}`).addEventListener('click', () => {
            const total_pages = Math.ceil(this.total_count / this.items_per_page);
            if (this.current_page < total_pages) {
                this.go_to_page(this.current_page + 1);
            }
        });

        document.getElementById(`last-page-${this.page_id}`).addEventListener('click', () => {
            const total_pages = Math.ceil(this.total_count / this.items_per_page);
            this.go_to_page(total_pages);
        });

        // Actions
        document.getElementById(`refresh-data-${this.page_id}`).addEventListener('click', () => {
            this.refresh_data();
        });

        document.getElementById(`export-excel-${this.page_id}`).addEventListener('click', () => {
            this.export_to_excel();
        });
    }

    collect_filters() {
        this.filters = {
            search_text: document.getElementById(`search-input-${this.page_id}`).value,
            item_group: document.getElementById(`item-group-filter-${this.page_id}`).value,
            warehouse: document.getElementById(`warehouse-filter-${this.page_id}`).value,
            brand: document.getElementById(`brand-filter-${this.page_id}`).value,
            status: document.getElementById(`status-filter-${this.page_id}`).value
        };
        this.update_filter_status();
    }

    update_filter_status() {
        const activeFilters = Object.entries(this.filters)
            .filter(([key, value]) => value && value !== 'all')
            .map(([key, value]) => `${key}: ${value}`);
        
        const statusEl = document.getElementById(`filter-status-${this.page_id}`);
        if (activeFilters.length > 0) {
            statusEl.textContent = `Filtres actifs: ${activeFilters.join(', ')}`;
            statusEl.className = 'ml-3 text-info';
        } else {
            statusEl.textContent = 'Aucun filtre appliqué';
            statusEl.className = 'ml-3 text-muted';
        }
    }

    reset_filters() {
        // Reset form values
        document.getElementById(`search-input-${this.page_id}`).value = '';
        document.getElementById(`item-group-filter-${this.page_id}`).value = '';
        document.getElementById(`warehouse-filter-${this.page_id}`).value = '';
        document.getElementById(`brand-filter-${this.page_id}`).value = '';
        document.getElementById(`status-filter-${this.page_id}`).value = 'all';

        // Reset internal filters
        this.filters = {
            search_text: '',
            item_group: '',
            warehouse: '',
            brand: '',
            status: 'all'
        };

        this.update_filter_status();
        this.apply_filters();
    }

    update_sort_config() {
        this.sort_config = {
            field: document.getElementById(`sort-field-${this.page_id}`).value,
            order: document.getElementById(`sort-order-${this.page_id}`).value
        };
        this.apply_filters();
    }

    async apply_filters() {
        this.current_page = 1;
        await this.load_items();
    }

    async go_to_page(page) {
        this.current_page = page;
        await this.load_items();
    }

    async load_items() {
        if (this.is_loading) return;

        try {
            this.show_loading(true);
            this.is_loading = true;

            const offset = (this.current_page - 1) * this.items_per_page;
            
            const response = await this.api_call('search_items', {
                ...this.filters,
                limit: this.items_per_page,
                offset: offset,
                sort_by: this.sort_config.field,
                sort_order: this.sort_config.order
            });

            if (response.success) {
                this.current_items = response.data.items;
                this.total_count = response.data.total_count;
                this.current_page = response.data.current_page;
                
                this.render_items();
                this.update_statistics();
                this.update_pagination();
            } else {
                throw new Error(response.error || 'Erreur chargement données');
            }

        } catch (error) {
            this.handle_error("Erreur chargement articles", error);
        } finally {
            this.show_loading(false);
            this.is_loading = false;
        }
    }

    render_items() {
        const tbody = document.getElementById(`items-tbody-${this.page_id}`);
        
        if (this.current_items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center text-muted py-4">
                        <i class="fa fa-inbox fa-2x mb-2"></i><br>
                        Aucun article trouvé
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.current_items.map(item => {
            const stockClass = item.total_stock > 0 ? 'text-success' : 'text-danger';
            const stockValue = (item.total_stock * item.selling_rate).toFixed(2);
            
            return `
                <tr data-item-code="${item.item_code}">
                    <td>
                        <strong>${item.item_code}</strong>
                        ${item.has_variants ? '<span class="badge badge-info badge-sm ml-1">Variantes</span>' : ''}
                    </td>
                    <td>${item.item_name || ''}</td>
                    <td>${item.item_group || ''}</td>
                    <td>${item.brand || ''}</td>
                    <td>${item.stock_uom || ''}</td>
                    <td class="${stockClass}">
                        <strong>${parseFloat(item.total_stock).toFixed(2)}</strong>
                    </td>
                    <td>${parseFloat(item.selling_rate).toFixed(2)} €</td>
                    <td>${stockValue} €</td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary btn-sm item-info-btn" 
                                    data-item-code="${item.item_code}"
                                    title="Détails article">
                                <i class="fa fa-info"></i>
                            </button>
                            <button class="btn btn-outline-success btn-sm item-stock-btn" 
                                    data-item-code="${item.item_code}"
                                    title="Détails stock">
                                <i class="fa fa-cubes"></i>
                            </button>
                            <button class="btn btn-outline-warning btn-sm item-edit-btn" 
                                    data-item-code="${item.item_code}"
                                    title="Modifier article">
                                <i class="fa fa-edit"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Attach event handlers to action buttons
        this.setup_row_event_handlers();
    }

    setup_row_event_handlers() {
        const self = this;

        // Info buttons
        document.querySelectorAll('.item-info-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const itemCode = this.getAttribute('data-item-code');
                self.show_item_details(itemCode);
            });
        });

        // Stock buttons
        document.querySelectorAll('.item-stock-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                
                const itemCode = this.getAttribute('data-item-code');
                console.log("Bouton Info cliqué pour l'article:", itemCode);
                self.show_stock_details(itemCode);
            });
        });

        // Edit buttons
        document.querySelectorAll('.item-edit-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const itemCode = this.getAttribute('data-item-code');
                self.edit_item(itemCode);
            });
        });
    }

    update_statistics() {
        const totalValue = this.current_items.reduce((sum, item) => 
            sum + (item.total_stock * item.selling_rate), 0);
        
        const stockItems = this.current_items.filter(item => item.total_stock > 0).length;

        document.getElementById(`total-items-${this.page_id}`).textContent = 
            this.total_count.toLocaleString();
        document.getElementById(`stock-items-${this.page_id}`).textContent = 
            stockItems.toLocaleString();
        document.getElementById(`total-value-${this.page_id}`).textContent = 
            totalValue.toLocaleString() + ' €';
        document.getElementById(`displayed-count-${this.page_id}`).textContent = 
            this.current_items.length.toLocaleString();
    }

    update_pagination() {
        const totalPages = Math.ceil(this.total_count / this.items_per_page);
        const startItem = ((this.current_page - 1) * this.items_per_page) + 1;
        const endItem = Math.min(this.current_page * this.items_per_page, this.total_count);

        // Update info
        document.getElementById(`pagination-info-${this.page_id}`).textContent = 
            `Affichage de ${startItem} à ${endItem} sur ${this.total_count} articles`;

        // Update current page indicator
        document.getElementById(`current-page-${this.page_id}`).textContent = 
            `Page ${this.current_page}`;

        // Update button states
        document.getElementById(`first-page-${this.page_id}`).disabled = this.current_page === 1;
        document.getElementById(`prev-page-${this.page_id}`).disabled = this.current_page === 1;
        document.getElementById(`next-page-${this.page_id}`).disabled = this.current_page === totalPages;
        document.getElementById(`last-page-${this.page_id}`).disabled = this.current_page === totalPages;
    }

    async show_item_details(itemCode) {
        try {
            const response = await this.api_call('get_item_complete_details', { item_code: itemCode });
            console.log("Chargement des détails pour l'article:", itemCode);
            
            if (response.success) {
                this.render_item_details_modal(response);
            } else {
                throw new Error(response.error || 'Erreur récupération détails');
            }
        } catch (error) {
            this.handle_error("Erreur détails article", error);
        }
    }

    async show_stock_details(itemCode) {
        try {
            const response = await this.api_call('get_item_stock_details', { item_code: itemCode });
            this.render_stock_details_modal(itemCode, response);
        } catch (error) {
            this.handle_error("Erreur détails stock", error);
        }
    }

    edit_item(itemCode) {
        frappe.set_route('Form', 'Item', itemCode);
    }

    render_item_details_modal(data) {
        const item = data.basic_info;
        const stock = data.stock_info;
        const pricing = data.pricing_info;

        const modalContent = `
            <div class="modal fade" id="item-details-modal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fa fa-cube"></i> Détails Article: ${item.item_name}
                            </h5>
                            <button type="button" class="close" data-dismiss="modal">
                                <span>&times;</span>
                            </button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <h6>Informations Générales</h6>
                                    <table class="table table-sm">
                                        <tr><td><strong>Code:</strong></td><td>${item.item_code}</td></tr>
                                        <tr><td><strong>Nom:</strong></td><td>${item.item_name}</td></tr>
                                        <tr><td><strong>Groupe:</strong></td><td>${item.item_group}</td></tr>
                                        <tr><td><strong>Marque:</strong></td><td>${item.brand || '-'}</td></tr>
                                        <tr><td><strong>UOM:</strong></td><td>${item.stock_uom}</td></tr>
                                        <tr><td><strong>Stock Item:</strong></td><td>${item.is_stock_item ? 'Oui' : 'Non'}</td></tr>
                                    </table>
                                </div>
                                <div class="col-md-6">
                                    <h6>Stock & Prix</h6>
                                    <table class="table table-sm">
                                        <tr><td><strong>Stock Total:</strong></td><td>${stock.total_stock}</td></tr>
                                        <tr><td><strong>Stock Réservé:</strong></td><td>${stock.total_reserved}</td></tr>
                                        <tr><td><strong>Stock Disponible:</strong></td><td>${stock.available_stock}</td></tr>
                                        <tr><td><strong>Prix Vente:</strong></td><td>${pricing.standard_selling_rate} €</td></tr>
                                        <tr><td><strong>Prix Achat:</strong></td><td>${pricing.standard_buying_rate} €</td></tr>
                                        <tr><td><strong>Entrepôts:</strong></td><td>${stock.warehouse_count}</td></tr>
                                    </table>
                                </div>
                            </div>
                            ${item.description ? `<div class="mt-3"><h6>Description</h6><p>${item.description}</p></div>` : ''}
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-dismiss="modal">Fermer</button>
                            <button type="button" class="btn btn-primary" onclick="frappe.set_route('Form', 'Item', '${item.item_code}')">
                                Modifier Article
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal and add new one
        const existingModal = document.getElementById('item-details-modal');
        if (existingModal) {
            existingModal.remove();
        }

        document.body.insertAdjacentHTML('beforeend', modalContent);
        $('#item-details-modal').modal('show');
    }

    render_stock_details_modal(itemCode, stockData) {
        const modalContent = `
            <div class="modal fade" id="stock-details-modal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fa fa-cubes"></i> Détails Stock: ${itemCode}
                            </h5>
                            <button type="button" class="close" data-dismiss="modal">
                                <span>&times;</span>
                            </button>
                        </div>
                        <div class="modal-body">
                            <div class="table-responsive">
                                <table class="table table-striped">
                                    <thead>
                                        <tr>
                                            <th>Entrepôt</th>
                                            <th>Stock Actuel</th>
                                            <th>Réservé</th>
                                            <th>Commandé</th>
                                            <th>Disponible</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${stockData.warehouses ? stockData.warehouses.map(w => `
                                            <tr>
                                                <td>${w.warehouse_name || w.warehouse}</td>
                                                <td>${w.actual_qty}</td>
                                                <td>${w.reserved_qty}</td>
                                                <td>${w.ordered_qty}</td>
                                                <td>${w.actual_qty - w.reserved_qty}</td>
                                            </tr>
                                        `).join('') : '<tr><td colspan="5">Aucune donnée stock</td></tr>'}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-dismiss="modal">Fermer</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal and add new one
        const existingModal = document.getElementById('stock-details-modal');
        if (existingModal) {
            existingModal.remove();
        }

        document.body.insertAdjacentHTML('beforeend', modalContent);
        $('#stock-details-modal').modal('show');
    }

    async refresh_data() {
        await this.load_filter_options();
        await this.load_items();
        this.show_success_message("Données actualisées");
    }

    async export_to_excel() {
        try {
            this.show_loading(true);
            
            // Get all items (not just current page)
            const response = await this.api_call('search_items', {
                ...this.filters,
                limit: 10000,  // Large limit to get all items
                offset: 0,
                sort_by: this.sort_config.field,
                sort_order: this.sort_config.order
            });

            if (response.success) {
                this.download_excel(response.data.items);
            } else {
                throw new Error(response.error || 'Erreur export');
            }

        } catch (error) {
            this.handle_error("Erreur export Excel", error);
        } finally {
            this.show_loading(false);
        }
    }

    download_excel(items) {
        const headers = ['Code Article', 'Nom Article', 'Groupe', 'Marque', 'UOM', 'Stock Total', 'Prix Vente', 'Valeur Stock'];
        const csvContent = [
            headers.join(','),
            ...items.map(item => [
                item.item_code,
                `"${item.item_name || ''}"`,
                item.item_group || '',
                item.brand || '',
                item.stock_uom || '',
                item.total_stock,
                item.selling_rate,
                (item.total_stock * item.selling_rate).toFixed(2)
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `articles_sobelec_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    }

    show_loading(show) {
        const loadingEl = document.getElementById(`loading-${this.page_id}`);
        if (loadingEl) {
            loadingEl.style.display = show ? 'block' : 'none';
        }
    }

    async api_call(method, args = {}) {
        return new Promise((resolve, reject) => {
            frappe.call({
                method: `sobelec_extension.api_consolidated.${method}`,
                args: args,
                callback: function(response) {
                    if (response.message) {
                        resolve(response.message);
                    } else {
                        reject(new Error('Réponse API invalide'));
                    }
                },
                error: function(error) {
                    reject(error);
                }
            });
        });
    }

    handle_error(title, error) {
        console.error(title + ':', error);
        frappe.msgprint({
            title: title,
            message: error.message || error.toString(),
            indicator: 'red'
        });
    }

    show_success_message(message) {
        frappe.show_alert({
            message: message,
            indicator: 'green'
        });
    }
}

// Page initialization function
frappe.pages['item-by-ciel'].on_page_load = function(wrapper) {
    window.sobelec_manager = new SobelecItemManager(wrapper);
};

// Ensure jQuery is loaded
if (typeof $ === 'undefined') {
    console.error('jQuery not loaded');
}
