import frappe
from frappe import _
import json

@frappe.whitelist()
def get_item_details_config():
    """Récupérer la configuration des champs à afficher dans la dialog"""
    # Configuration par défaut (paramétrable via Custom Settings ou Site Config)
    default_config = {
        "basic_fields": [
            {"fieldname": "item_code", "label": "Code Article", "fieldtype": "Data", "show": True},
            {"fieldname": "item_name", "label": "Nom Article", "fieldtype": "Data", "show": True},
            {"fieldname": "item_group", "label": "Groupe Article", "fieldtype": "Link", "show": True},
            {"fieldname": "brand", "label": "Marque", "fieldtype": "Link", "show": True},
            {"fieldname": "stock_uom", "label": "UOM", "fieldtype": "Link", "show": True},
            {"fieldname": "description", "label": "Description", "fieldtype": "Text Editor", "show": True},
            {"fieldname": "disabled", "label": "Désactivé", "fieldtype": "Check", "show": True},
            {"fieldname": "is_stock_item", "label": "Article Stock", "fieldtype": "Check", "show": True},
            {"fieldname": "has_variants", "label": "A des Variantes", "fieldtype": "Check", "show": True},
            {"fieldname": "variant_of", "label": "Variante de", "fieldtype": "Link", "show": True},
        ],
        "stock_fields": [
            {"fieldname": "stock_total", "label": "Stock Total", "fieldtype": "Float", "show": True},
            {"fieldname": "reserved_qty_total", "label": "Quantité Réservée", "fieldtype": "Float", "show": True},
            {"fieldname": "projected_qty_total", "label": "Quantité Projetée", "fieldtype": "Float", "show": True},
            {"fieldname": "stock_by_warehouse", "label": "Stock par Entrepôt", "fieldtype": "Table", "show": True},
        ],
        "price_fields": [
            {"fieldname": "standard_rate", "label": "Taux Standard", "fieldtype": "Currency", "show": True},
            {"fieldname": "valuation_rate", "label": "Taux d'Évaluation", "fieldtype": "Currency", "show": True},
            {"fieldname": "selling_prices", "label": "Prix de Vente", "fieldtype": "Table", "show": True},
            {"fieldname": "buying_prices", "label": "Prix d'Achat", "fieldtype": "Table", "show": True},
        ],
        "additional_fields": [
            {"fieldname": "weight_per_unit", "label": "Poids par Unité", "fieldtype": "Float", "show": False},
            {"fieldname": "weight_uom", "label": "UOM Poids", "fieldtype": "Link", "show": False},
            {"fieldname": "shelf_life_in_days", "label": "Durée de Vie (jours)", "fieldtype": "Int", "show": False},
            {"fieldname": "end_of_life", "label": "Fin de Vie", "fieldtype": "Date", "show": False},
            {"fieldname": "warranty_period", "label": "Période de Garantie", "fieldtype": "Data", "show": False},
            {"fieldname": "suppliers", "label": "Fournisseurs", "fieldtype": "Table", "show": True},
            {"fieldname": "images", "label": "Images", "fieldtype": "HTML", "show": True},
            {"fieldname": "manufacturing", "label": "Fabrication", "fieldtype": "Check", "show": False},
            {"fieldname": "purchase_uom", "label": "UOM Achat", "fieldtype": "Link", "show": False},
            {"fieldname": "sales_uom", "label": "UOM Vente", "fieldtype": "Link", "show": False},
        ],
        "dialog_settings": {
            "title_format": "Détails Article - {item_code}",
            "size": "extra-large",
            "show_images_gallery": True,
            "max_images_per_row": 4,
            "image_height": "120px"
        }
    }
    
    # Vérifier s'il y a une configuration personnalisée dans les Settings
    try:
        custom_config = frappe.get_single_value("System Settings", "item_details_config")
        if custom_config:
            parsed_config = json.loads(custom_config)
            # Merger avec la config par défaut
            for key in default_config:
                if key in parsed_config:
                    default_config[key] = parsed_config[key]
    except Exception as e:
        frappe.log_error(f"Erreur lors du chargement de la config: {str(e)}")
    
    return default_config

@frappe.whitelist()
def get_item_complete_details(item_code, config=None):
    """Récupérer tous les détails d'un article selon la configuration"""
    if not item_code:
        frappe.throw(_("Item Code is required"))
    
    if not frappe.db.exists("Item", item_code):
        frappe.throw(_("Article {0} n'existe pas").format(item_code))
    
    # Récupérer la configuration
    if not config:
        config = get_item_details_config()
    
    try:
        # Récupérer le document Item
        item_doc = frappe.get_doc("Item", item_code)
        result = {}
        
        # Champs de base
        for field in config.get("basic_fields", []):
            if field.get("show", False):
                fieldname = field["fieldname"]
                result[fieldname] = getattr(item_doc, fieldname, None)
        
        # Champs de stock si activés
        if any(f.get("show") for f in config.get("stock_fields", [])):
            stock_bins = frappe.get_all("Bin", 
                filters={"item_code": item_code}, 
                fields=["warehouse", "actual_qty", "reserved_qty", "projected_qty", "planned_qty"]
            )
            
            result["stock_total"] = sum([bin_data.actual_qty or 0 for bin_data in stock_bins])
            result["reserved_qty_total"] = sum([bin_data.reserved_qty or 0 for bin_data in stock_bins])
            result["projected_qty_total"] = sum([bin_data.projected_qty or 0 for bin_data in stock_bins])
            result["stock_by_warehouse"] = stock_bins
        
        # Champs de prix si activés
        if any(f.get("show") for f in config.get("price_fields", [])):
            result["standard_rate"] = getattr(item_doc, 'standard_rate', 0)
            result["valuation_rate"] = getattr(item_doc, 'valuation_rate', 0)
            
            result["selling_prices"] = frappe.get_all("Item Price",
                filters={"item_code": item_code, "selling": 1},
                fields=["price_list", "price_list_rate", "currency", "valid_from", "valid_upto"]
            )
            
            result["buying_prices"] = frappe.get_all("Item Price",
                filters={"item_code": item_code, "buying": 1},
                fields=["price_list", "price_list_rate", "currency", "valid_from", "valid_upto"]
            )
        
        # Champs additionnels selon configuration
        for field in config.get("additional_fields", []):
            if field.get("show", False):
                fieldname = field["fieldname"]
                
                if fieldname == "suppliers":
                    result["suppliers"] = frappe.get_all("Item Supplier",
                        filters={"parent": item_code},
                        fields=["supplier", "supplier_part_no", "lead_time_days"]
                    )
                elif fieldname == "images":
                    result["images"] = get_item_images(item_code, item_doc)
                else:
                    result[fieldname] = getattr(item_doc, fieldname, None)
        
        # Ajouter des informations supplémentaires utiles
        result["creation_date"] = item_doc.creation
        result["modified_date"] = item_doc.modified
        result["owner"] = item_doc.owner
        
        # Ajouter la configuration utilisée
        result["_config"] = config
        
        return {
            "success": True,
            "data": result
        }
        
    except Exception as e:
        frappe.log_error(f"Erreur dans get_item_complete_details: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

def get_item_images(item_code, item_doc):
    """Récupérer toutes les images d'un article"""
    images = []
    
    try:
        # Image principale
        if item_doc.image:
            images.append({
                "url": item_doc.image,
                "type": "Image Principale",
                "is_main": True
            })
        
        # Website image si différente
        if item_doc.website_image and item_doc.website_image != item_doc.image:
            images.append({
                "url": item_doc.website_image,
                "type": "Image Site Web",
                "is_main": False
            })
        
        # Récupérer les fichiers attachés (images)
        attachments = frappe.get_all("File",
            filters={
                "attached_to_doctype": "Item",
                "attached_to_name": item_code,
                "is_private": 0
            },
            fields=["file_url", "file_name", "file_size"]
        )
        
        image_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg']
        
        for attachment in attachments:
            if attachment.file_url:
                # Vérifier si c'est une image
                if any(ext in attachment.file_name.lower() for ext in image_extensions):
                    # Éviter les doublons
                    if attachment.file_url not in [img["url"] for img in images]:
                        images.append({
                            "url": attachment.file_url,
                            "type": f"Fichier: {attachment.file_name}",
                            "file_name": attachment.file_name,
                            "file_size": attachment.file_size,
                            "is_main": False
                        })
        
    except Exception as e:
        frappe.log_error(f"Erreur lors de la récupération des images: {str(e)}")
    
    return images

@frappe.whitelist()
def update_item_details_config(config_json):
    """Mettre à jour la configuration des détails d'articles"""
    try:
        # Valider le JSON
        config = json.loads(config_json)
        
        # Sauvegarder dans les Settings (nécessite des permissions admin)
        frappe.db.set_single_value("System Settings", "item_details_config", config_json)
        frappe.db.commit()
        
        return {
            "success": True,
            "message": "Configuration mise à jour avec succès"
        }
        
    except json.JSONDecodeError:
        return {
            "success": False,
            "error": "Format JSON invalide"
        }
    except Exception as e:
        frappe.log_error(f"Erreur lors de la mise à jour de la config: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()
def get_item_quick_info(item_code):
    """Récupérer des informations rapides pour le tooltip ou preview"""
    if not item_code:
        return {}
    
    try:
        item_info = frappe.get_value("Item", item_code, [
            "item_name", "item_group", "stock_uom", "image", 
            "standard_rate", "disabled"
        ], as_dict=True)
        
        if not item_info:
            return {}
        
        # Stock total rapide
        stock_total = frappe.db.sql("""
            SELECT SUM(actual_qty) as total 
            FROM `tabBin` 
            WHERE item_code = %s
        """, (item_code,), as_dict=True)
        
        item_info["stock_total"] = stock_total[0].total if stock_total else 0
        
        return item_info
        
    except Exception as e:
        frappe.log_error(f"Erreur dans get_item_quick_info: {str(e)}")
        return {}