import frappe
from frappe import _

@frappe.whitelist()
def get_item_stock_and_price(item_code):
	if not item_code:
		frappe.throw(_("Item Code is required"))

	# Récupérer stock total (depuis Bin)
	stock_bins = frappe.get_all("Bin", filters={"item_code": item_code}, fields=["actual_qty"])
	stock_total = sum([bin.actual_qty for bin in stock_bins])

	# Récupérer le prix de vente (Item Price)
	item_price = frappe.get_value("Item Price", {
		"item_code": item_code,
		"selling": 1,
		"price_list": "Vente standard"
	}, "price_list_rate") or 0

	return {
		"item_code": item_code,
		"stock_total": stock_total,
		"selling_price": item_price
	}



