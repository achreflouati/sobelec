import frappe
from frappe import _

@frappe.whitelist()
def get_sales_order_qty(item_code):
	if not item_code:
		frappe.throw("Item Code is required")

	items = frappe.get_all("Sales Order Item", filters={
		"item_code": item_code,
		"docstatus": 1
	}, fields=["qty", "delivered_qty"])

	qte_cmd_client = sum(item.qty - item.delivered_qty for item in items)

	return {"item_code": item_code, "pending_sales_qty": qte_cmd_client}






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


@frappe.whitelist()
def get_projected_stock(item_code):
	if not item_code:
		frappe.throw("Item Code is required")

	stock_data = get_item_stock(item_code)
	purchase_data = get_purchase_order_qty(item_code)
	sales_data = get_sales_order_qty(item_code)

	stock_projecte = stock_data["stock_total"] + purchase_data["pending_purchase_qty"] - sales_data["pending_sales_qty"]

	return {
		"item_code": item_code,
		"stock_total": stock_data["stock_total"],
		"pending_purchase_qty": purchase_data["pending_purchase_qty"],
		"pending_sales_qty": sales_data["pending_sales_qty"],
		"projected_stock": stock_projecte
	}
