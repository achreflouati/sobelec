import frappe
from frappe import _
import json

@frappe.whitelist()
def get_filter_options():
    """Récupérer les options pour les filtres"""
    try:
        # Récupérer les groupes d'articles
        item_groups = frappe.get_all("Item Group", fields=["name"])
        
        # Récupérer les entrepôtsss
        warehouses = frappe.get_all("Warehouse", 
            filters={"is_group": 0, "disabled": 0}, 
            fields=["name"], 
            order_by="name"
        )
        
        return {
            "success": True,
            "data": {
                "item_groups": [group.name for group in item_groups],
                "warehouses": [warehouse.name for warehouse in warehouses]
            }
        }
        
    except Exception as e:
        frappe.log_error(f"Erreur dans get_filter_options: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

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
        # Construction des filtres
        conditions = ["i.disabled = 0"]  # Par défaut, ne pas montrer les articles désactivés
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
            
        if filters.get('has_stock'):
            conditions.append("EXISTS (SELECT 1 FROM `tabBin` b WHERE b.item_code = i.item_code AND b.actual_qty > 0)")
            
        where_clause = "WHERE " + " AND ".join(conditions)
        
        # Requête principale simplifiée
        query = f"""
        SELECT 
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
            i.end_of_life
        FROM `tabItem` i
        {where_clause}
        ORDER BY i.item_code
        LIMIT %s OFFSET %s
        """
        
        # Ajouter limit et offset aux valeurs
        values.extend([limit, offset])
        
        # Exécuter la requête
        items = frappe.db.sql(query, values, as_dict=True)
        
        # Enrichir chaque article avec les données de stock, prix et fournisseurs
        enriched_items = []
        for item in items:
            enriched_item = enrich_item_data(item)
            enriched_items.append(enriched_item)
        
        # Compter le total pour la pagination
        count_query = f"""
        SELECT COUNT(DISTINCT i.item_code) as total
        FROM `tabItem` i
        {where_clause}
        """
        
        count_values = values[:-2]  # Enlever limit et offset
        total_count = frappe.db.sql(count_query, count_values, as_dict=True)[0].total
        
        return {
            "success": True,
            "data": enriched_items,
            "total": total_count,
            "limit": limit,
            "offset": offset,
            "has_more": (offset + limit) < total_count
        }
        
    except Exception as e:
        frappe.log_error(f"Erreur dans get_items_ciel_style: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "data": []
        }

def enrich_item_data(item):
    """
    Enrichir les données d'un article avec stock, prix et fournisseurs
    """
    item_code = item.item_code
    
    # Récupérer les données de stock (entrepôt principal avec le plus de stock)
    stock_data = frappe.db.sql("""
        SELECT 
            warehouse,
            actual_qty,
            reserved_qty,
            projected_qty,
            valuation_rate,
            stock_value
        FROM `tabBin`
        WHERE item_code = %s AND actual_qty > 0
        ORDER BY actual_qty DESC
        LIMIT 1
    """, (item_code,), as_dict=True)
    
    if stock_data:
        stock = stock_data[0]
        item.update({
            'stock_reel': stock.actual_qty or 0,
            'stock_bloque': stock.reserved_qty or 0,
            'stock_projete': stock.projected_qty or 0,
            'taux_evaluation': stock.valuation_rate or item.valuation_rate or 0,
            'valeur_stock': stock.stock_value or 0,
            'emplacement': stock.warehouse
        })
    else:
        # Pas de stock
        item.update({
            'stock_reel': 0,
            'stock_bloque': 0,
            'stock_projete': 0,
            'taux_evaluation': item.valuation_rate or 0,
            'valeur_stock': 0,
            'emplacement': ''
        })
    
    # Récupérer le prix de vente
    selling_price = frappe.db.sql("""
        SELECT price_list_rate, currency
        FROM `tabItem Price`
        WHERE item_code = %s AND selling = 1
        AND (valid_upto IS NULL OR valid_upto >= CURDATE())
        ORDER BY valid_from DESC
        LIMIT 1
    """, (item_code,), as_dict=True)
    
    if selling_price:
        prix_vente_ht = selling_price[0].price_list_rate or 0
        devise_vente = selling_price[0].currency or 'DA'
    else:
        prix_vente_ht = item.standard_rate or 0
        devise_vente = 'DA'
    
    # Récupérer le prix d'achat
    buying_price = frappe.db.sql("""
        SELECT price_list_rate, currency
        FROM `tabItem Price`
        WHERE item_code = %s AND buying = 1
        AND (valid_upto IS NULL OR valid_upto >= CURDATE())
        ORDER BY valid_from DESC
        LIMIT 1
    """, (item_code,), as_dict=True)
    
    if buying_price:
        prix_achat_ht = buying_price[0].price_list_rate or 0
        devise_achat = buying_price[0].currency or 'DA'
    else:
        prix_achat_ht = item.last_purchase_rate or 0
        devise_achat = 'DA'
    
    # Récupérer le fournisseur principal
    supplier = frappe.db.sql("""
        SELECT supplier, supplier_part_no
        FROM `tabItem Supplier`
        WHERE parent = %s
        ORDER BY idx
        LIMIT 1
    """, (item_code,), as_dict=True)
    
    if supplier:
        nom_fournisseur = supplier[0].supplier or ''
        ref_fournisseur = supplier[0].supplier_part_no or ''
    else:
        nom_fournisseur = ''
        ref_fournisseur = ''
    
    # Calculs
    prix_vente_ttc = round(prix_vente_ht * 1.19, 2)  # Supposer 19% TVA
    
    if prix_vente_ht > 0:
        marge_pct = round(((prix_vente_ht - prix_achat_ht) / prix_vente_ht) * 100, 2)
    else:
        marge_pct = 0
    
    # Ajouter les données calculées
    item.update({
        'prix_vente_ht': prix_vente_ht,
        'devise_vente': devise_vente,
        'prix_achat_ht': prix_achat_ht,
        'devise_achat': devise_achat,
        'prix_vente_ttc': prix_vente_ttc,
        'nom_fournisseur': nom_fournisseur,
        'ref_fournisseur': ref_fournisseur,
        'marge_pct': marge_pct,
        'taux_tva': 19.0  # Valeur par défaut
    })
    
    return item

@frappe.whitelist()
def get_item_groups():
    """Récupérer la liste des groupes d'articles pour les filtres"""
    try:
        groups = frappe.get_all("Item Group", 
            fields=["name", "parent_item_group"], 
            order_by="name"
        )
        return {"success": True, "data": groups}
    except Exception as e:
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def get_warehouses():
    """Récupérer la liste des entrepôts pour les filtres"""
    try:
        warehouses = frappe.get_all("Warehouse", 
            fields=["name", "warehouse_name"], 
            order_by="name"
        )
        return {"success": True, "data": warehouses}
    except Exception as e:
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def export_items_to_excel(filters=None):
    """Exporter les articles vers Excel (style Ciel)"""
    try:
        # Récupérer tous les articles (sans limit)
        result = get_items_ciel_style(filters, limit=10000, offset=0)
        
        if not result.get("success"):
            return result
        
        items = result.get("data", [])
        
        # Préparer les données pour l'export
        export_data = []
        for item in items:
            export_data.append({
                "Code": item.item_code,
                "Désignation": item.item_name,
                "Groupe": item.item_group,
                "Stock Réel": item.stock_reel,
                "Stock Bloqué": item.stock_bloque,
                "Emplacement": item.emplacement,
                "Prix Vente HT": item.prix_vente_ht,
                "Prix Vente TTC": item.prix_vente_ttc,
                "Prix Achat": item.prix_achat_ht,
                "Marge %": item.marge_pct,
                "Fournisseur": item.nom_fournisseur,
                "Réf Fournisseur": item.ref_fournisseur,
                "Marque": item.brand,
                "UOM": item.stock_uom
            })
        
        return {
            "success": True,
            "data": export_data,
            "filename": "articles_export.xlsx"
        }
        
    except Exception as e:
        frappe.log_error(f"Erreur export Excel: {str(e)}")
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def get_item_stock_details(item_code):
    """Récupérer les détails de stock d'un article spécifique"""
    try:
        if not item_code:
            return {"success": False, "error": "Code article requis"}
        
        # Stock par entrepôt
        stock_details = frappe.db.sql("""
            SELECT 
                warehouse,
                actual_qty,
                reserved_qty,
                projected_qty,
                valuation_rate,
                stock_value
            FROM `tabBin`
            WHERE item_code = %s
            ORDER BY warehouse
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
