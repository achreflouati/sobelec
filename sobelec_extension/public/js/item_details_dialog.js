frappe.provide('sobelec_extension.item_details');

// Configuration globale
sobelec_extension.item_details.config = null;

// Charger la configuration au démarrage
sobelec_extension.item_details.load_config = function() {
    frappe.call({
        method: 'sobelec_extension.item_details_api.get_item_details_config',
        callback: function(r) {
            if (r.message) {
                sobelec_extension.item_details.config = r.message;
            }
        }
    });
};

// Ajouter les boutons info aux lignes d'articles
sobelec_extension.item_details.add_info_buttons = function() {
    setTimeout(() => {
        $('.list-row').each(function() {
            const $row = $(this);
            const item_code = $row.find('[data-fieldname="name"]').text().trim();
            
            if (item_code && !$row.find('.custom-info-btn').length) {
                // Trouver la zone d'actions
                const $actionsArea = $row.find('.list-row-col.ellipsis').first();
                
                if ($actionsArea.length) {
                    // Créer le bouton avec style Frappe
                    const $infoBtn = $(`
                        <button class="btn btn-xs btn-default custom-info-btn" 
                                data-item-code="${item_code}"
                                title="Voir détails complets"
                                style="margin-left: 4px; border: 1px solid #d1d8dd; color: #5e64ff;">
                            <svg class="icon icon-sm" style="stroke: currentColor;">
                                <use href="#icon-info"></use>
                            </svg>
                        </button>
                    `);
                    
                    $actionsArea.append($infoBtn);
                    
                    // Gérer le clic
                    $infoBtn.on('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        sobelec_extension.item_details.show_item_details(item_code);
                    });
                    
                    // Ajouter tooltip au hover
                    $infoBtn.hover(
                        function() {
                            sobelec_extension.item_details.show_quick_preview(item_code, $(this));
                        },
                        function() {
                            $('.item-quick-preview').remove();
                        }
                    );
                }
            }
        });
    }, 1000);
};

// Aperçu rapide au hover
sobelec_extension.item_details.show_quick_preview = function(item_code, $button) {
    frappe.call({
        method: 'sobelec_extension.item_details_api.get_item_quick_info',
        args: { item_code: item_code },
        callback: function(r) {
            if (r.message && Object.keys(r.message).length > 0) {
                const data = r.message;
                const tooltip = $(`
                    <div class="item-quick-preview" style="
                        position: absolute;
                        background: white;
                        border: 1px solid #d1d8dd;
                        border-radius: 6px;
                        padding: 12px;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                        z-index: 1000;
                        min-width: 250px;
                        font-size: 12px;
                    ">
                        <div style="display: flex; align-items: center; margin-bottom: 8px;">
                            ${data.image ? `<img src="${data.image}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px; margin-right: 8px;">` : ''}
                            <div>
                                <strong>${data.item_name || item_code}</strong><br>
                                <span class="text-muted">${data.item_group || ''}</span>
                            </div>
                        </div>
                        <div style="border-top: 1px solid #f0f0f0; padding-top: 8px;">
                            <div>Stock: <span class="badge badge-${data.stock_total > 0 ? 'success' : 'danger'}">${data.stock_total || 0}</span></div>
                            <div>Prix: ${data.standard_rate || 0} DA</div>
                            <div>UOM: ${data.stock_uom || ''}</div>
                        </div>
                    </div>
                `);
                
                const buttonOffset = $button.offset();
                tooltip.css({
                    top: buttonOffset.top - 120,
                    left: buttonOffset.left - 125
                });
                
                $('body').append(tooltip);
            }
        }
    });
};

// Afficher les détails complets de l'article
sobelec_extension.item_details.show_item_details = function(item_code) {
    frappe.show_alert({
        message: __('Chargement des détails...'),
        indicator: 'blue'
    });
    
    frappe.call({
        method: 'sobelec_extension.item_details_api.get_item_complete_details',
        args: {
            item_code: item_code
        },
        callback: function(r) {
            if (r.message && r.message.success) {
                sobelec_extension.item_details.render_item_dialog(r.message.data);
            } else {
                frappe.msgprint({
                    title: __('Erreur'),
                    message: r.message?.error || __('Impossible de récupérer les détails'),
                    indicator: 'red'
                });
            }
        }
    });
};

// Créer la dialog avec style Frappe
sobelec_extension.item_details.render_item_dialog = function(data) {
    const config = data._config || sobelec_extension.item_details.config;
    const dialog_settings = config.dialog_settings || {};
    
    // Créer les sections dynamiquement
    let dialog_fields = [];
    
    // Section Informations de base
    if (config.basic_fields && config.basic_fields.some(f => f.show)) {
        dialog_fields.push({
            fieldtype: 'Section Break',
            label: __('Informations Générales'),
            collapsible: 1
        });
        
        dialog_fields.push({
            fieldtype: 'Column Break'
        });
        
        config.basic_fields.forEach(field => {
            if (field.show) {
                let field_config = {
                    fieldtype: field.fieldtype,
                    fieldname: field.fieldname,
                    label: __(field.label),
                    read_only: 1
                };
                
                // Valeur du champ
                let value = data[field.fieldname];
                if (field.fieldtype === 'Check') {
                    value = value ? 1 : 0;
                }
                field_config.default = value;
                
                dialog_fields.push(field_config);
            }
        });
    }
    
    // Section Stock
    if (config.stock_fields && config.stock_fields.some(f => f.show)) {
        dialog_fields.push({
            fieldtype: 'Section Break',
            label: __('Informations Stock'),
            collapsible: 1
        });
        
        dialog_fields.push({
            fieldtype: 'Column Break'
        });
        
        config.stock_fields.forEach(field => {
            if (field.show && field.fieldname !== 'stock_by_warehouse') {
                dialog_fields.push({
                    fieldtype: field.fieldtype,
                    fieldname: field.fieldname,
                    label: __(field.label),
                    default: data[field.fieldname] || 0,
                    read_only: 1
                });
            }
        });
        
        // Tableau du stock par entrepôt
        if (config.stock_fields.find(f => f.fieldname === 'stock_by_warehouse' && f.show)) {
            let stock_html = sobelec_extension.item_details.build_stock_table(data.stock_by_warehouse || []);
            dialog_fields.push({
                fieldtype: 'HTML',
                fieldname: 'stock_table',
                options: stock_html
            });
        }
    }
    
    // Section Prix
    if (config.price_fields && config.price_fields.some(f => f.show)) {
        dialog_fields.push({
            fieldtype: 'Section Break',
            label: __('Informations Prix'),
            collapsible: 1
        });
        
        dialog_fields.push({
            fieldtype: 'Column Break'
        });
        
        // Prix standards
        ['standard_rate', 'valuation_rate'].forEach(fieldname => {
            const field = config.price_fields.find(f => f.fieldname === fieldname);
            if (field && field.show) {
                dialog_fields.push({
                    fieldtype: 'Currency',
                    fieldname: fieldname,
                    label: __(field.label),
                    default: data[fieldname] || 0,
                    read_only: 1
                });
            }
        });
        
        // Tableaux des prix
        if (config.price_fields.find(f => f.fieldname === 'selling_prices' && f.show)) {
            let selling_prices_html = sobelec_extension.item_details.build_prices_table(data.selling_prices || [], 'Vente');
            dialog_fields.push({
                fieldtype: 'HTML',
                fieldname: 'selling_prices_table',
                options: selling_prices_html
            });
        }
        
        if (config.price_fields.find(f => f.fieldname === 'buying_prices' && f.show)) {
            let buying_prices_html = sobelec_extension.item_details.build_prices_table(data.buying_prices || [], 'Achat');
            dialog_fields.push({
                fieldtype: 'HTML',
                fieldname: 'buying_prices_table',
                options: buying_prices_html
            });
        }
    }
    
    // Section Images
    if (config.additional_fields && config.additional_fields.find(f => f.fieldname === 'images' && f.show)) {
        dialog_fields.push({
            fieldtype: 'Section Break',
            label: __('Images ({0})').format(data.images ? data.images.length : 0),
            collapsible: 1
        });
        
        let images_html = sobelec_extension.item_details.build_images_gallery(data.images || [], dialog_settings);
        dialog_fields.push({
            fieldtype: 'HTML',
            fieldname: 'images_gallery',
            options: images_html
        });
    }
    
    // Section Fournisseurs
    if (config.additional_fields && config.additional_fields.find(f => f.fieldname === 'suppliers' && f.show)) {
        dialog_fields.push({
            fieldtype: 'Section Break',
            label: __('Fournisseurs'),
            collapsible: 1
        });
        
        let suppliers_html = sobelec_extension.item_details.build_suppliers_table(data.suppliers || []);
        dialog_fields.push({
            fieldtype: 'HTML',
            fieldname: 'suppliers_table',
            options: suppliers_html
        });
    }
    
    // Autres champs additionnels
    const other_fields = config.additional_fields?.filter(f => 
        f.show && !['images', 'suppliers'].includes(f.fieldname)
    );
    
    if (other_fields && other_fields.length > 0) {
        dialog_fields.push({
            fieldtype: 'Section Break',
            label: __('Informations Supplémentaires'),
            collapsible: 1
        });
        
        other_fields.forEach(field => {
            dialog_fields.push({
                fieldtype: field.fieldtype,
                fieldname: field.fieldname,
                label: __(field.label),
                default: data[field.fieldname],
                read_only: 1
            });
        });
    }
    
    // Créer la dialog
    const dialog = new frappe.ui.Dialog({
        title: (dialog_settings.title_format || 'Détails - {item_code}').replace('{item_code}', data.item_code),
        fields: dialog_fields,
        size: dialog_settings.size || 'large',
        primary_action_label: __('Fermer'),
        primary_action: function() {
            dialog.hide();
        },
        secondary_action_label: __('Ouvrir Article'),
        secondary_action: function() {
            frappe.set_route('Form', 'Item', data.item_code);
            dialog.hide();
        }
    });
    
    dialog.show();
    
    // Ajouter CSS personnalisé
    dialog.$wrapper.find('.modal-dialog').css('max-width', '90vw');
};

// Construire le tableau du stock
sobelec_extension.item_details.build_stock_table = function(stock_data) {
    if (!stock_data || stock_data.length === 0) {
        return '<div class="text-muted text-center py-3">' + __('Aucun stock disponible') + '</div>';
    }
    
    let html = `
        <div class="table-responsive mt-3">
            <table class="table table-bordered table-sm">
                <thead class="table-light">
                    <tr>
                        <th>${__('Entrepôt')}</th>
                        <th class="text-right">${__('Réel')}</th>
                        <th class="text-right">${__('Réservé')}</th>
                        <th class="text-right">${__('Projeté')}</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    stock_data.forEach(stock => {
        const actual_qty = stock.actual_qty || 0;
        html += `
            <tr>
                <td><strong>${stock.warehouse}</strong></td>
                <td class="text-right">
                    <span class="indicator-pill ${actual_qty > 0 ? 'green' : (actual_qty < 0 ? 'red' : 'grey')}">${actual_qty}</span>
                </td>
                <td class="text-right">${stock.reserved_qty || 0}</td>
                <td class="text-right">${stock.projected_qty || 0}</td>
            </tr>
        `;
    });
    
    html += '</tbody></table></div>';
    return html;
};

// Construire le tableau des prix
sobelec_extension.item_details.build_prices_table = function(prices_data, type) {
    if (!prices_data || prices_data.length === 0) {
        return `<div class="text-muted text-center py-2">${__('Aucun prix de {0} configuré').format(type.toLowerCase())}</div>`;
    }
    
    let html = `
        <h6 class="mt-3">${__('Prix de {0}').format(type)}</h6>
        <div class="table-responsive">
            <table class="table table-bordered table-sm">
                <thead class="table-light">
                    <tr>
                        <th>${__('Liste de Prix')}</th>
                        <th class="text-right">${__('Prix')}</th>
                        <th>${__('Devise')}</th>
                        <th>${__('Période')}</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    prices_data.forEach(price => {
        let period = '';
        if (price.valid_from || price.valid_upto) {
            period = `${price.valid_from || ''} - ${price.valid_upto || ''}`;
        }
        
        html += `
            <tr>
                <td><strong>${price.price_list}</strong></td>
                <td class="text-right"><span class="text-success">${frappe.format(price.price_list_rate, {fieldtype: 'Currency'})}</span></td>
                <td>${price.currency}</td>
                <td><small class="text-muted">${period}</small></td>
            </tr>
        `;
    });
    
    html += '</tbody></table></div>';
    return html;
};

// Construire la galerie d'images
sobelec_extension.item_details.build_images_gallery = function(images, settings) {
    if (!images || images.length === 0) {
        return '<div class="text-muted text-center py-3">' + __('Aucune image disponible') + '</div>';
    }
    
    const max_per_row = settings.max_images_per_row || 4;
    const image_height = settings.image_height || '120px';
    const col_class = `col-md-${12/max_per_row} col-sm-6`;
    
    let html = `<div class="row mt-3">`;
    
    images.forEach((img, index) => {
        const is_main = img.is_main ? '<span class="badge badge-primary">Principal</span>' : '';
        html += `
            <div class="${col_class} mb-3">
                <div class="card h-100">
                    <div class="position-relative">
                        <img src="${img.url}" 
                             class="card-img-top" 
                             style="height: ${image_height}; object-fit: cover; cursor: pointer;"
                             onclick="sobelec_extension.item_details.show_image_modal('${img.url}', '${img.type}')">
                        ${is_main}
                    </div>
                    <div class="card-body p-2">
                        <small class="text-muted d-block">${img.type}</small>
                        ${img.file_size ? `<small class="text-muted">${frappe.form.formatters.FileSize(img.file_size)}</small>` : ''}
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    return html;
};

// Construire le tableau des fournisseurs
sobelec_extension.item_details.build_suppliers_table = function(suppliers_data) {
    if (!suppliers_data || suppliers_data.length === 0) {
        return '<div class="text-muted text-center py-3">' + __('Aucun fournisseur configuré') + '</div>';
    }
    
    let html = `
        <div class="table-responsive mt-3">
            <table class="table table-bordered table-sm">
                <thead class="table-light">
                    <tr>
                        <th>${__('Fournisseur')}</th>
                        <th>${__('Référence Fournisseur')}</th>
                        <th class="text-right">${__('Délai (jours)')}</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    suppliers_data.forEach(supplier => {
        html += `
            <tr>
                <td><strong>${supplier.supplier}</strong></td>
                <td>${supplier.supplier_part_no || '-'}</td>
                <td class="text-right">${supplier.lead_time_days || '-'}</td>
            </tr>
        `;
    });
    
    html += '</tbody></table></div>';
    return html;
};

// Modal pour afficher une image en grand
sobelec_extension.item_details.show_image_modal = function(image_url, image_type) {
    const modal = new frappe.ui.Dialog({
        title: image_type || __('Image'),
        fields: [
            {
                fieldtype: 'HTML',
                fieldname: 'image',
                options: `
                    <div class="text-center">
                        <img src="${image_url}" style="max-width: 100%; max-height: 70vh; object-fit: contain;">
                    </div>
                `
            }
        ],
        size: 'large'
    });
    
    modal.show();
};

// Initialisation
$(document).ready(function() {
    // Charger la configuration
    sobelec_extension.item_details.load_config();
    
    if (window.location.pathname.includes('/app/item')) {
        // Observer pour les changements
        const observer = new MutationObserver(function(mutations) {
            let shouldAdd = false;
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes.length > 0) {
                    shouldAdd = true;
                }
            });
            if (shouldAdd) {
                sobelec_extension.item_details.add_info_buttons();
            }
        });
        
        const container = document.querySelector('.layout-main-section');
        if (container) {
            observer.observe(container, {
                childList: true,
                subtree: true
            });
        }
        
        // Ajouter les boutons initialement
        sobelec_extension.item_details.add_info_buttons();
        
        // Re-ajouter après navigation
        $(document).on('page-change', function() {
            setTimeout(() => {
                sobelec_extension.item_details.add_info_buttons();
            }, 1000);
        });
    }
});