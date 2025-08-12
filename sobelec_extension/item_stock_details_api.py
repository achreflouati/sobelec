import frappe
from frappe import _

@frappe.whitelist()
def get_item_stock_details(item_code):
    """Récupérer les détails de stock par entrepôt pour un article"""
    try:
        if not item_code:
            return {"success": False, "error": "Item code requis"}
        
        # Récupérer le stock par entrepôt
        stock_details = frappe.db.sql("""
            SELECT 
                b.warehouse,
                b.actual_qty,
                b.reserved_qty,
                b.projected_qty,
                b.valuation_rate,
                b.stock_value,
                w.warehouse_name
            FROM `tabBin` b
            LEFT JOIN `tabWarehouse` w ON b.warehouse = w.name
            WHERE b.item_code = %s
            ORDER BY b.actual_qty DESC
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
