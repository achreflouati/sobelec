import frappe

def before_save_item(doc, method):
    price = frappe.db.get_value(
        "Item Price",
        {
            "item_code": doc.name,
            "price_list": "Standard Selling",
            "selling": 1
        },
        "price_list_rate"
    )
    doc.custom_prix_de_vente = price or 0
    # if doc.custom_prix_de_vente < 0:
    #     frappe.throw("Le prix de vente ne peut pas être négatif.")
    # doc.custom_prix_de_vente = round(doc.custom_prix_de_vente, 2)
    # doc.custom_prix_de_vente = frappe.utils.flt(doc.custom_prix_de_vente, 2)