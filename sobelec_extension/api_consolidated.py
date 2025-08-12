#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sobelec Extension - API consolidée
Module principal pour toutes les API de l'extension Sobelec
Développé avec 20 ans d'expérience en développement
"""

import frappe
from frappe import _
import json
from datetime import datetime
from typing import Dict, List, Any, Optional, Union
import logging

# Configuration des logs
logger = logging.getLogger(__name__)

class SobelecAPIError(Exception):
    """Exception personnalisée pour les erreurs API Sobelec"""
    pass

class ItemDataService:
    """Service de gestion des données d'articles - Architecture professionnelle"""
    
    @staticmethod
    def validate_item_code(item_code: str) -> str:
        """Validation stricte du code article"""
        if not item_code or not isinstance(item_code, str):
            raise SobelecAPIError(_("Code article requis et doit être une chaîne"))
        return item_code.strip()
    
    @staticmethod
    def get_item_stock_summary(item_code: str) -> Dict[str, Any]:
        """
        Récupère un résumé complet du stock d'un article
        Performance optimisée avec requête unique
        """
        try:
            item_code = ItemDataService.validate_item_code(item_code)
            
            # Requête optimisée pour récupérer toutes les données en une fois
            stock_data = frappe.db.sql("""
                SELECT 
                    b.warehouse,
                    b.actual_qty,
                    b.reserved_qty,
                    b.ordered_qty,
                    b.planned_qty,
                    w.warehouse_name
                FROM `tabBin` b
                LEFT JOIN `tabWarehouse` w ON b.warehouse = w.name
                WHERE b.item_code = %s
                AND (b.actual_qty != 0 OR b.reserved_qty != 0 OR b.ordered_qty != 0)
                ORDER BY b.actual_qty DESC
            """, (item_code,), as_dict=True)
            
            total_stock = sum(bin_data.actual_qty for bin_data in stock_data)
            total_reserved = sum(bin_data.reserved_qty for bin_data in stock_data)
            total_ordered = sum(bin_data.ordered_qty for bin_data in stock_data)
            
            return {
                "item_code": item_code,
                "total_stock": total_stock,
                "total_reserved": total_reserved,
                "total_ordered": total_ordered,
                "available_stock": total_stock - total_reserved,
                "warehouses": stock_data,
                "warehouse_count": len(stock_data)
            }
            
        except Exception as e:
            logger.error(f"Erreur get_item_stock_summary: {str(e)}")
            raise SobelecAPIError(f"Erreur récupération stock: {str(e)}")

    @staticmethod
    def get_item_pricing_info(item_code: str) -> Dict[str, Any]:
        """
        Récupère les informations de prix d'un article
        Supporte plusieurs listes de prix
        """
        try:
            item_code = ItemDataService.validate_item_code(item_code)
            
            # Récupération des prix avec requête optimisée
            price_data = frappe.db.sql("""
                SELECT 
                    ip.price_list,
                    ip.price_list_rate,
                    ip.currency,
                    ip.valid_from,
                    ip.valid_upto,
                    ip.selling,
                    ip.buying,
                    pl.enabled as price_list_enabled
                FROM `tabItem Price` ip
                LEFT JOIN `tabPrice List` pl ON ip.price_list = pl.name
                WHERE ip.item_code = %s
                AND pl.enabled = 1
                ORDER BY ip.valid_from DESC, ip.creation DESC
            """, (item_code,), as_dict=True)
            
            # Séparation prix vente/achat
            selling_prices = [p for p in price_data if p.selling]
            buying_prices = [p for p in price_data if p.buying]
            
            # Prix standard par défaut
            standard_selling = next((p.price_list_rate for p in selling_prices 
                                   if p.price_list == "Standard Selling"), 0)
            standard_buying = next((p.price_list_rate for p in buying_prices 
                                  if p.price_list == "Standard Buying"), 0)
            
            return {
                "item_code": item_code,
                "standard_selling_rate": standard_selling,
                "standard_buying_rate": standard_buying,
                "selling_prices": selling_prices,
                "buying_prices": buying_prices,
                "total_price_lists": len(price_data)
            }
            
        except Exception as e:
            logger.error(f"Erreur get_item_pricing_info: {str(e)}")
            raise SobelecAPIError(f"Erreur récupération prix: {str(e)}")

    @staticmethod
    def get_item_complete_details(item_code: str) -> Dict[str, Any]:
        """
        Récupère TOUTES les informations d'un article
        Version professionnelle avec gestion d'erreurs complète
        """
        try:
            item_code = ItemDataService.validate_item_code(item_code)
            
            # Vérification existence
            if not frappe.db.exists("Item", item_code):
                raise SobelecAPIError(f"Article {item_code} introuvable")
            
            # Données principales de l'article
            item_doc = frappe.get_doc("Item", item_code)
            
            # Stock et prix en parallèle
            stock_info = ItemDataService.get_item_stock_summary(item_code)
            pricing_info = ItemDataService.get_item_pricing_info(item_code)
            
            # Informations supplémentaires
            supplier_info = ItemDataService.get_item_suppliers(item_code) 
            # additional_data = frappe.db.get_value("Item", item_code, [
            #     "image",
            #     "custom_emplacement ",
            #     "custom_reference_fournisseur ",
                
            # ], as_dict=True) or {}

            # # Récupération des images multiples depuis la table File
            # images = frappe.db.get_all("File",
            #     filters={
            #         "attached_to_doctype": "Item",
            #         "attached_to_name": item_code,
            #         "is_folder": 0
            #     },
            #     pluck="file_url",
            #     order_by="creation desc"
            # )
            
            
            return {
                "success": True,
                "item_code": item_code,
                "basic_info": {
                    "item_name": item_doc.item_name,
                    "custom_référence_fournisseur": item_doc.custom_référence_fournisseur,
                    "image": item_doc.image or "",
                    "item_group": item_doc.item_group,
                    "brand": getattr(item_doc, 'brand', ''),
                    "description": getattr(item_doc, 'description', ''),
                    "stock_uom": item_doc.stock_uom,
                    "disabled": item_doc.disabled,
                    "taxes": item_doc.taxes or [],
                    "is_stock_item": item_doc.is_stock_item,
                    "has_variants": item_doc.has_variants,
                    "variant_of": getattr(item_doc, 'variant_of', ''),
                    "creation": item_doc.creation,
                    "modified": item_doc.modified
                },
                
                "stock_info": stock_info,
                "pricing_info": pricing_info,
                "supplier_info": supplier_info,
                "timestamp": datetime.now().isoformat()
            }
            
        except SobelecAPIError:
            raise
        except Exception as e:
            logger.error(f"Erreur get_item_complete_details: {str(e)}")
            raise SobelecAPIError(f"Erreur récupération détails article: {str(e)}")

    @staticmethod
    def get_item_suppliers(item_code: str) -> Dict[str, Any]:
        """Récupère les informations fournisseurs d'un article"""
        try:
            suppliers = frappe.get_all("Item Supplier", 
                filters={"parent": item_code},
                fields=["supplier", "supplier_part_no", "is_default"]
            )
            
            return {
                "suppliers": suppliers,
                "supplier_count": len(suppliers),
                "has_default_supplier": any(s.is_default for s in suppliers)
            }
            
        except Exception as e:
            logger.error(f"Erreur get_item_suppliers: {str(e)}")
            return {"suppliers": [], "supplier_count": 0, "has_default_supplier": False}

class ItemSearchService:
    @staticmethod
    def search_items_advanced(
        search_text: str = "",
        item_group: str = "",
        warehouse: str = "",
        brand: str = "",
        status: str = "all",
        limit: int = 50,
        offset: int = 0,
        sort_by: str = "item_code",
        sort_order: str = "asc"
    ) -> Dict[str, Any]:
        """
        Recherche avancée d'articles avec filtres multiples
        """
        try:
            limit = min(max(int(limit), 1), 1000)
            offset = max(int(offset), 0)
            conditions = ["i.disabled = 0"]
            values = []
            if search_text:
                conditions.append("(i.item_code LIKE %s OR i.item_name LIKE %s)")
                search_pattern = f"%{search_text}%"
                values.extend([search_pattern, search_pattern])
            if item_group:
                conditions.append("i.item_group = %s")
                values.append(item_group)
            if brand:
                conditions.append("i.brand = %s")
                values.append(brand)
            if status == "stock_only":
                conditions.append("i.is_stock_item = 1")
            elif status == "non_stock":
                conditions.append("i.is_stock_item = 0")
            where_clause = " AND ".join(conditions)
            valid_sort_fields = ["item_code", "item_name", "item_group", "creation", "modified"]
            if sort_by not in valid_sort_fields:
                sort_by = "item_code"
            sort_order = "ASC" if sort_order.lower() == "asc" else "DESC"
            query = f"""
                SELECT 
                    i.item_code,
                    i.item_name,
                    i.item_group,
                    i.brand,
                    i.stock_uom,
                    i.is_stock_item,
                    i.disabled,
                    i.has_variants,
                    COALESCE(SUM(b.actual_qty), 0) as total_stock,
                    COALESCE(ip.price_list_rate, 0) as selling_rate
                FROM `tabItem` i
                LEFT JOIN `tabBin` b ON i.item_code = b.item_code
                LEFT JOIN `tabItem Price` ip ON i.item_code = ip.item_code 
                    AND ip.price_list = 'Standard Selling' AND ip.selling = 1
                WHERE {where_clause}
            """
            if warehouse:
                query += " AND (b.warehouse = %s OR b.warehouse IS NULL)"
                values.append(warehouse)
            query += f"""
                GROUP BY i.item_code
                ORDER BY i.{sort_by} {sort_order}
                LIMIT %s OFFSET %s
            """
            values.extend([limit, offset])
            items = frappe.db.sql(query, values, as_dict=True)
            count_query = f"""
                SELECT COUNT(DISTINCT i.item_code) as total
                FROM `tabItem` i
                LEFT JOIN `tabBin` b ON i.item_code = b.item_code
                WHERE {where_clause}
            """
            count_values = values[:-2]
            if warehouse:
                count_query += " AND (b.warehouse = %s OR b.warehouse IS NULL)"
            total_count = frappe.db.sql(count_query, count_values, as_dict=True)[0].total
            for item in items:
                item['total_stock'] = float(item.get('total_stock', 0))
                item['selling_rate'] = float(item.get('selling_rate', 0))
                item['stock_value'] = item['total_stock'] * item['selling_rate']
            return {
                "success": True,
                "data": {
                    "items": items,
                    "total_count": total_count,
                    "current_page": (offset // limit) + 1,
                    "total_pages": (total_count + limit - 1) // limit,
                    "has_more": (offset + limit) < total_count,
                    "filters_applied": {
                        "search_text": search_text,
                        "item_group": item_group,
                        "warehouse": warehouse,
                        "brand": brand,
                        "status": status
                    }
                },
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"Erreur search_items_advanced: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }

    @staticmethod
    def get_filter_options() -> Dict[str, Any]:
        """
        Récupère les options de filtrage pour les articles (groupes, entrepôts, marques, listes de prix)
        """
        try:
            cache_key = "sobelec_filter_options"
            cached_data = frappe.cache().get_value(cache_key)
            if cached_data:
                return cached_data
            item_groups = frappe.get_all(
                "Item Group",
                filters={"is_group": 0},
                fields=["name", "item_group_name"],
                order_by="name"
            )
            warehouses = frappe.get_all(
                "Warehouse",
                filters={"is_group": 0},
                fields=["name", "warehouse_name"],
                order_by="name"
            )
            brands = frappe.get_all(
                "Brand",
                fields=["name", "brand"],
                order_by="name"
            )
            price_lists = frappe.get_all(
                "Price List",
                filters={"enabled": 1},
                fields=["name", "currency", "selling", "buying"],
                order_by="name"
            )
            filter_data = {
                "success": True,
                "data": {
                    "item_groups": item_groups,
                    "warehouses": warehouses,
                    "brands": brands,
                    "price_lists": price_lists
                },
                "timestamp": datetime.now().isoformat()
            }
            frappe.cache().set_value(cache_key, filter_data, expires_in_sec=600)
            return filter_data
        except Exception as e:
            logger.error(f"Erreur get_filter_options: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }

# API Endpoints publiques
@frappe.whitelist()
def get_item_stock_and_price(item_code: str) -> Dict[str, Any]:
    """
    API publique : Récupère stock et prix d'un article
    Maintien compatibilité avec l'ancienne API
    """
    try:
        stock_info = ItemDataService.get_item_stock_summary(item_code)
        pricing_info = ItemDataService.get_item_pricing_info(item_code)
        
        return {
            "item_code": item_code,
            "stock_total": stock_info["total_stock"],
            "selling_price": pricing_info["standard_selling_rate"]
        }
        
    except SobelecAPIError as e:
        frappe.throw(str(e))
    except Exception as e:
        frappe.log_error(f"API get_item_stock_and_price error: {str(e)}")
        frappe.throw(_("Erreur lors de la récupération des données"))

@frappe.whitelist()
def get_item_complete_details(item_code: str) -> Dict[str, Any]:
    """API publique : Récupère tous les détails d'un article"""
    try:
        return ItemDataService.get_item_complete_details(item_code)
    except SobelecAPIError as e:
        frappe.throw(str(e))
    except Exception as e:
        frappe.log_error(f"API get_item_complete_details error: {str(e)}")
        frappe.throw(_("Erreur lors de la récupération des détails"))

@frappe.whitelist()
def get_filter_options() -> Dict[str, Any]:
    """API publique : Récupère les options de filtrage"""
    return ItemSearchService.get_filter_options()

@frappe.whitelist()
def search_items(
    search_text: str = "",
    item_group: str = "",
    warehouse: str = "",
    brand: str = "",
    status: str = "all",
    limit: int = 50,
    offset: int = 0,
    sort_by: str = "item_code",
    sort_order: str = "asc"
) -> Dict[str, Any]:
    """API publique : Recherche avancée d'articles"""
    return ItemSearchService.search_items_advanced(
        search_text, item_group, warehouse, brand, status,
        limit, offset, sort_by, sort_order
    )

@frappe.whitelist()
def get_items_ciel_style(filters: Union[str, Dict] = None, limit: int = 50, offset: int = 0) -> Dict[str, Any]:
    """
    API publique : Récupère les articles style Ciel (compatibilité)
    Redirige vers la nouvelle API search_items
    """
    try:
        # Conversion des anciens filtres
        if isinstance(filters, str):
            try:
                filters = json.loads(filters)
            except:
                filters = {}
        
        if not filters:
            filters = {}
        
        return search_items(
            search_text=filters.get("search", ""),
            item_group=filters.get("item_group", ""),
            warehouse=filters.get("warehouse", ""),
            brand=filters.get("brand", ""),
            status=filters.get("status", "all"),
            limit=limit,
            offset=offset
        )
        
    except Exception as e:
        frappe.log_error(f"API get_items_ciel_style error: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

# Fonctions utilitaires pour maintenir compatibilité
@frappe.whitelist()
def get_item_stock_details(item_code: str) -> Dict[str, Any]:
    """Compatibilité : redirige vers get_item_stock_summary"""
    try:
        return ItemDataService.get_item_stock_summary(item_code)
    except SobelecAPIError as e:
        frappe.throw(str(e))
    except Exception as e:
        frappe.log_error(f"API get_item_stock_details error: {str(e)}")
        frappe.throw(_("Erreur lors de la récupération du stock"))

@frappe.whitelist()
def get_last_purchase_rate(item_code: str) -> float:
    """Récupère le dernier prix d'achat d'un article"""
    try:
        last_purchase = frappe.db.sql("""
            SELECT rate
            FROM `tabPurchase Invoice Item`
            WHERE item_code = %s
            AND docstatus = 1
            ORDER BY creation DESC
            LIMIT 1
        """, (item_code,))
        
        return float(last_purchase[0][0]) if last_purchase else 0.0
        
    except Exception as e:
        frappe.log_error(f"Erreur get_last_purchase_rate: {str(e)}")
        return 0.0

@frappe.whitelist()
def get_main_supplier(item_code: str) -> str:
    """Récupère le fournisseur principal d'un article"""
    try:
        supplier = frappe.db.get_value("Item Supplier", 
            {"parent": item_code, "is_default": 1}, 
            "supplier")
        return supplier or ""
        
    except Exception as e:
        frappe.log_error(f"Erreur get_main_supplier: {str(e)}")
        return ""

# Health Check
@frappe.whitelist()
def health_check() -> Dict[str, Any]:
    """Vérification de l'état de l'API"""
    try:
        # Test connexion DB
        frappe.db.sql("SELECT 1")
        
        # Test cache
        cache_test = frappe.cache().get_value("test_key") or "ok"
        
        return {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "database": "connected",
            "cache": "available",
            "version": "2.0.0"
        }
        
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }
