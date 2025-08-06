@frappe.whitelist()
def get_item_stock(item_code):
	if not item_code:
		frappe.throw("Item Code is required")

	stock_bins = frappe.get_all("Bin", filters={"item_code": item_code}, fields=["actual_qty"])
	stock_total = sum(bin.actual_qty for bin in stock_bins)

	return {"item_code": item_code, "stock_total": stock_total}
