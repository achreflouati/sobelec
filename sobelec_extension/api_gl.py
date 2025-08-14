# sobelec_extension/api_gl.py
from collections import defaultdict
from decimal import Decimal
import frappe
from frappe.utils import getdate

def _decimal(n):  # robust to None
    try:
        return Decimal(str(n or 0))
    except Exception:
        return Decimal(0)

@frappe.whitelist()
def get_gl_filter_options():
    """Options de filtres (entreprises, comptes, journaux, tiers, centres de coût, projets)."""
    companies = frappe.get_all("Company", fields=["name", "company_name"], order_by="name")
    accounts = frappe.get_all("Account", fields=["name", "account_name", "company", "root_type", "is_group"], order_by="name")
    voucher_types = sorted({d.name for d in frappe.get_all("DocType", filters={"istable": 0}, fields=["name"])})
    cost_centers = frappe.get_all("Cost Center", fields=["name", "cost_center_name", "company"], order_by="name")
    projects = frappe.get_all("Project", fields=["name", "project_name"], order_by="name")

    parties = frappe.get_all("Party Type", fields=["name"])  # “Customer”, “Supplier”, “Employee”, etc.
    # Optionnel : on pourra livrer la liste des parties selon party_type à la demande.

    return {
        "success": True,
        "data": {
            "companies": companies,
            "accounts": [a for a in accounts if not a.get("is_group")],
            "voucher_types": voucher_types,
            "cost_centers": cost_centers,
            "projects": projects,
            "party_types": parties
        }
    }

def _build_conditions(filters):
    conds = []
    params = {}

    if filters.get("company"):
        conds.append("gle.company = %(company)s")
        params["company"] = filters["company"]

    if filters.get("from_date"):
        conds.append("gle.posting_date >= %(from_date)s")
        params["from_date"] = getdate(filters["from_date"])

    if filters.get("to_date"):
        conds.append("gle.posting_date <= %(to_date)s")
        params["to_date"] = getdate(filters["to_date"])

    if filters.get("account"):
        conds.append("gle.account = %(account)s")
        params["account"] = filters["account"]

    if filters.get("voucher_type"):
        conds.append("gle.voucher_type = %(voucher_type)s")
        params["voucher_type"] = filters["voucher_type"]

    if filters.get("voucher_no"):
        conds.append("gle.voucher_no = %(voucher_no)s")
        params["voucher_no"] = filters["voucher_no"]

    if filters.get("party_type"):
        conds.append("gle.party_type = %(party_type)s")
        params["party_type"] = filters["party_type"]

    if filters.get("party"):
        conds.append("gle.party = %(party)s")
        params["party"] = filters["party"]

    if filters.get("cost_center"):
        conds.append("gle.cost_center = %(cost_center)s")
        params["cost_center"] = filters["cost_center"]

    if filters.get("project"):
        conds.append("gle.project = %(project)s")
        params["project"] = filters["project"]

    # Recherche plein texte sur libellé/remarques
    if filters.get("search_text"):
        conds.append("(gle.remarks LIKE %(search)s OR gle.against LIKE %(search)s)")
        params["search"] = f"%{filters['search_text']}%"

    # Exclure les pièces annulées
    if str(filters.get("exclude_cancelled", 1)) in ("1", "true", "True"):
        conds.append("gle.is_cancelled = 0")

    return " AND ".join(conds) if conds else "1=1", params

@frappe.whitelist()
def search_gl_entries(**kwargs):
    """
    Recherche paginée avec totaux et solde courant (à la CIEL).
    Args attendus :
      - from_date, to_date, company, account, voucher_type, voucher_no,
        party_type, party, cost_center, project, search_text, exclude_cancelled
      - limit (int), offset (int), sort_by ('posting_date' recommandé), sort_order ('asc'|'desc')
    """
    filters = kwargs or {}
    limit = int(filters.get("limit") or 50)
    offset = int(filters.get("offset") or 0)
    sort_by = filters.get("sort_by") or "posting_date, voucher_no"
    sort_order = filters.get("sort_order") or "asc"

    cond_sql, params = _build_conditions(filters)

    # Comptage total pour pagination
    total_count = frappe.db.sql(
        f"""SELECT COUNT(*) FROM `tabGL Entry` gle WHERE {cond_sql}""", params
    )[0][0]

    # Totaux (débit/crédit) pour la vue actuelle
    totals_row = frappe.db.sql(
        f"""
        SELECT COALESCE(SUM(gle.debit),0), COALESCE(SUM(gle.credit),0)
        FROM `tabGL Entry` gle
        WHERE {cond_sql}
        """,
        params,
    )[0]
    total_debit, total_credit = map(Decimal, totals_row)

    # Récup des écritures page courante
    rows = frappe.db.sql(
        f"""
        SELECT
            gle.name, gle.posting_date, gle.account, gle.account_currency,
            gle.debit, gle.credit, gle.debit_in_account_currency, gle.credit_in_account_currency,
            gle.against, gle.voucher_type, gle.voucher_no,
            gle.party_type, gle.party, gle.remarks,
            gle.company, gle.cost_center, gle.project
        FROM `tabGL Entry` gle
        WHERE {cond_sql}
        ORDER BY {sort_by} {sort_order}
        LIMIT %(limit)s OFFSET %(offset)s
        """,
        {**params, "limit": limit, "offset": offset},
        as_dict=True,
    )

    # Calcul du solde courant (running balance) PAR COMPTE sur la fenêtre visible.
    # Si tu veux un vrai "solde d'ouverture" avant from_date, on peut l'ajouter (voir plus bas).
    running = defaultdict(Decimal)
    # Option solde d’ouverture par compte (facultatif, selon CIEL) :
    if filters.get("from_date"):
        opening_rows = frappe.db.sql(
            f"""
            SELECT gle.account, COALESCE(SUM(gle.debit - gle.credit), 0) bal
            FROM `tabGL Entry` gle
            WHERE {cond_sql.replace("gle.posting_date >= %(from_date)s", "gle.posting_date < %(from_date)s")}
            GROUP BY gle.account
            """,
            params,
            as_dict=True
        )
        for r in opening_rows:
            running[r.account] = _decimal(r.bal)

    for e in rows:
        acct = e["account"]
        running[acct] += _decimal(e["debit"]) - _decimal(e["credit"])
        e["running_balance"] = float(running[acct])

    # Solde global (toutes lignes filtrées)
    closing_balance = float(total_debit - total_credit)

    return {
        "success": True,
        "data": {
            "entries": rows,
            "totals": {
                "debit": float(total_debit),
                "credit": float(total_credit),
                "closing_balance": closing_balance
            },
            "total_count": total_count,
            "current_page": (offset // limit) + 1
        }
    }
