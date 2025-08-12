import frappe
from frappe import _
import json

@frappe.whitelist()
def get_items_ciel_style(filters=None, limit=50, offset=0):
    """
    Récupérer les articles avec toutes les informations style Ciel
    mais optimisé pour Frappe
    """
    # Convertir filters en dict si c'est une string JSON
    if isinstance(filters, str):
        try:
            filters = json.loads(filters)
        except:
            filters = {}
    
    if not filters:
        filters = {}
    
    # Convertir limit et offset en int
    try:
        limit = int(limit)
        offset = int(offset)
    except:
        limit = 50
        offset = 0
    
    try:
        # Construction de la requête SQL optimisée
        conditions = []
        values = []
        
        # Filtres de base
        if filters.get('item_code'):
            conditions.append("i.item_code LIKE %s")
            values.append(f"%{filters['item_code']}%")
            
        if filters.get('item_name'):
            conditions.append("i.item_name LIKE %s")
            values.append(f"%{filters['item_name']}%")
            
        if filters.get('item_group'):
            conditions.append("i.item_group = %s")
            values.append(filters['item_group'])
            
        if filters.get('warehouse'):
            conditions.append("b.warehouse = %s")
            values.append(filters['warehouse'])
            
        if filters.get('disabled') is not None:
            conditions.append("i.disabled = %s")
            values.append(filters['disabled'])
            
        # Filtre stock
        if filters.get('has_stock'):
            conditions.append("COALESCE(b.actual_qty, 0) > 0")
            
        where_clause = ""
        if conditions:
            where_clause = "WHERE " + " AND ".join(conditions)
        
        # Requête principale avec JOINs optimisés
        query = f"""
        SELECT 
            -- Informations de base
            i.item_code,
            i.item_name,
            i.item_group,
            i.description,
            i.image,
            i.brand,
            i.stock_uom,
            i.disabled,
            i.is_stock_item,
            i.standard_rate,
            i.valuation_rate,
            i.last_purchase_rate,
            i.weight_per_unit,
            i.weight_uom,
            i.end_of_life,
            
            -- Stock par entrepôt principal
            COALESCE(b.actual_qty, 0) as stock_reel,
            COALESCE(b.reserved_qty, 0) as stock_bloque,
            COALESCE(b.projected_qty, 0) as stock_projete,
            COALESCE(b.valuation_rate, i.valuation_rate, 0) as taux_evaluation,
            COALESCE(b.stock_value, 0) as valeur_stock,
            b.warehouse as emplacement,
            
            -- Prix de vente principal
            sp.price_list_rate as prix_vente_ht,
            sp.currency as devise_vente,
            
            -- Prix d'achat principal  
            bp.price_list_rate as prix_achat_ht,
            bp.currency as devise_achat,
            
            -- Fournisseur principal
            sup.supplier as nom_fournisseur,
            sup.supplier_part_no as ref_fournisseur,
            
            -- Calculs
            ROUND(COALESCE(sp.price_list_rate, 0) * 1.19, 2) as prix_vente_ttc,
            ROUND(
                CASE 
                    WHEN COALESCE(sp.price_list_rate, 0) > 0 THEN
                        (COALESCE(sp.price_list_rate, 0) - COALESCE(bp.price_list_rate, i.last_purchase_rate, 0)) / 
                        sp.price_list_rate * 100
                    ELSE 0
                END, 2
            ) as marge_pct
            
        FROM `tabItem` i
        
        LEFT JOIN (
            SELECT item_code, warehouse, actual_qty, reserved_qty, projected_qty, valuation_rate, stock_value,
                   ROW_NUMBER() OVER (PARTITION BY item_code ORDER BY actual_qty DESC) as rn
            FROM `tabBin`
        ) b ON i.item_code = b.item_code AND b.rn = 1
        
        LEFT JOIN (
            SELECT item_code, price_list_rate, currency,
                   ROW_NUMBER() OVER (PARTITION BY item_code ORDER BY valid_from DESC NULLS LAST) as rn
            FROM `tabItem Price`
            WHERE selling = 1
        ) sp ON i.item_code = sp.item_code AND sp.rn = 1
        
        LEFT JOIN (
            SELECT item_code, price_list_rate, currency,
                   ROW_NUMBER() OVER (PARTITION BY item_code ORDER BY valid_from DESC NULLS LAST) as rn
            FROM `tabItem Price`
            WHERE buying = 1
        ) bp ON i.item_code = bp.item_code AND bp.rn = 1
        
        LEFT JOIN (
            SELECT parent as item_code, supplier, supplier_part_no,
                   ROW_NUMBER() OVER (PARTITION BY parent ORDER BY idx) as rn
            FROM `tabItem Supplier`
        ) sup ON i.item_code = sup.item_code AND sup.rn = 1
        
        {where_clause}
        
        ORDER BY i.item_code
        LIMIT {limit} OFFSET {offset}
        """
            FROM `tabItem Price` 
            WHERE selling = 1 AND (valid_upto IS NULL OR valid_upto >= CURDATE())
        ) sp ON i.item_code = sp.item_code AND sp.rn = 1
        
        LEFT JOIN (
            SELECT item_code, price_list_rate, currency,
                   ROW_NUMBER() OVER (PARTITION BY item_code ORDER BY valid_from DESC) as rn
            FROM `tabItem Price` 
            WHERE buying = 1 AND (valid_upto IS NULL OR valid_upto >= CURDATE())
        ) bp ON i.item_code = bp.item_code AND bp.rn = 1
        
        LEFT JOIN (
            SELECT parent as item_code, supplier, supplier_part_no,
                   ROW_NUMBER() OVER (PARTITION BY parent ORDER BY idx) as rn
            FROM `tabItem Supplier`
        ) sup ON i.item_code = sup.item_code AND sup.rn = 1
        
        {where_clause}
        ORDER BY i.item_code
        LIMIT %s OFFSET %s
        """
        
        values.extend([limit, offset])
        
        items = frappe.db.sql(query, values, as_dict=True)
        
        # Calculer les totaux
        total_query = f"""
        SELECT 
            COUNT(DISTINCT i.item_code) as total_items,
            SUM(COALESCE(b.actual_qty, 0)) as total_stock,
            SUM(COALESCE(b.stock_value, 0)) as total_valeur
        FROM `tabItem` i
        LEFT JOIN `tabBin` b ON i.item_code = b.item_code
        {where_clause}
        """
        
        totals = frappe.db.sql(total_query, values[:-2], as_dict=True)[0] if values else frappe.db.sql(total_query, as_dict=True)[0]
        
        return {
            "success": True,
            "data": items,
            "totals": totals,
            "has_more": len(items) == limit
        }
        
    except Exception as e:
        frappe.log_error(f"Erreur dans get_items_ciel_style: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()
def get_filter_options():
    """Récupérer les options pour les filtres"""
    try:
        # Groupes d'articles
        item_groups = frappe.get_all("Item Group", 
            fields=["name"], 
            order_by="name"
        )
        
        # Entrepôts
        warehouses = frappe.get_all("Warehouse", 
            fields=["name"], 
            order_by="name"
        )
        
        # Marques
        brands = frappe.get_all("Brand", 
            fields=["name"], 
            order_by="name"
        )
        
        return {
            "item_groups": [g.name for g in item_groups],
            "warehouses": [w.name for w in warehouses],
            "brands": [b.name for b in brands]
        }
        
    except Exception as e:
        frappe.log_error(f"Erreur dans get_filter_options: {str(e)}")
        return {
            "item_groups": [],
            "warehouses": [],
            "brands": []
        }

@frappe.whitelist()
def get_item_stock_details(item_code):
    """Récupérer le détail du stock par entrepôt pour un article"""
    try:
        stock_details = frappe.db.sql("""
        SELECT 
            warehouse,
            actual_qty,
            reserved_qty,
            projected_qty,
            valuation_rate,
            stock_value
        FROM `tabBin`
        WHERE item_code = %s AND actual_qty != 0
        ORDER BY actual_qty DESC
        """, (item_code,), as_dict=True)
        
        return {
            "success": True,
            "data": stock_details
        }
        
    except Exception as e:
        frappe.log_error(f"Erreur dans get_item_stock_details: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()
def export_items_ciel(filters=None):
    """Exporter les données au format CSV/Excel"""
    try:
        data = get_items_ciel_style(filters, limit=10000, offset=0)
        
        if not data.get("success"):
            return data
            
        return {
            "success": True,
            "data": data["data"],
            "filename": f"items_ciel_{frappe.utils.today()}.csv"
        }
        
    except Exception as e:
        frappe.log_error(f"Erreur dans export_items_ciel: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()
def update_item_quick(item_code, field, value):
    """Mise à jour rapide d'un champ d'article"""
    try:
        # Vérifier les permissions
        if not frappe.has_permission("Item", "write"):
            frappe.throw(_("Pas de permission pour modifier les articles"))
        
        # Champs autorisés pour modification rapide
        allowed_fields = [
            'standard_rate', 'disabled', 'description', 
            'item_name', 'brand'
        ]
        
        if field not in allowed_fields:
            frappe.throw(_("Champ non autorisé pour modification rapide"))
        
        # Mise à jour
        frappe.db.set_value("Item", item_code, field, value)
        frappe.db.commit()
        
        return {
            "success": True,
            "message": _("Article mis à jour avec succès")
        }
        
    except Exception as e:
        frappe.log_error(f"Erreur dans update_item_quick: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }
