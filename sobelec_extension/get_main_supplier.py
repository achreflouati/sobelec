import frappe
from frappe import _    

@frappe.whitelist()
def get_purchase_order_qty(item_code):
	if not item_code:
		frappe.throw("Item Code is required")

	items = frappe.get_all("Purchase Order Item", filters={
		"item_code": item_code,
		"docstatus": 1
	}, fields=["qty", "received_qty"])

	qte_cmd_fournisseur = sum(item.qty - item.received_qty for item in items)

	return {"item_code": item_code, "pending_purchase_qty": qte_cmd_fournisseur}