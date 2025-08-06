app_name = "sobelec_extension"
app_title = "Sobelec_Extension"
app_publisher = "achref"
app_description = "Sobelec_Extension"
app_email = "lsi.louati@gmail.com"
app_license = "mit"

# Apps
# ------------------

# required_apps = []

# Each item in the list will be shown as an app in the apps page
# add_to_apps_screen = [
# 	{
# 		"name": "sobelec_extension",
# 		"logo": "/assets/sobelec_extension/logo.png",
# 		"title": "Sobelec_Extension",
# 		"route": "/sobelec_extension",
# 		"has_permission": "sobelec_extension.api.permission.has_app_permission"
# 	}
# ]

# Includes in <head>
# ------------------
doc_events = {
    "Item Price": {
        "after_save": "sobelec_extension.sobelec_extension.item_sobelec_price.update_item_price_on_change"
    },
    "Item": {
        "before_save": "sobelec_extension.sobelec_extension.item_sobelec_price.before_save_item",
        "validate": "sobelec_extension.sobelec_extension.item_sobelec_price.before_save_item"
    }
}


# app_include_js = "/assets/sobelec_extension/js/link_preview_extension.js"
# app_include_css = "/assets/sobelec_extension/css/link_preview_extension.css"

# include js, css files in header of desk.html
# app_include_css = "/assets/sobelec_extension/css/sobelec_extension.css"
# app_include_js = "/assets/sobelec_extension/js/sobelec_extension.js"

# include js, css files in header of web template
# web_include_css = "/assets/sobelec_extension/css/sobelec_extension.css"
# web_include_js = "/assets/sobelec_extension/js/sobelec_extension.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "sobelec_extension/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "sobelec_extension/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "sobelec_extension.utils.jinja_methods",
# 	"filters": "sobelec_extension.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "sobelec_extension.install.before_install"
# after_install = "sobelec_extension.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "sobelec_extension.uninstall.before_uninstall"
# after_uninstall = "sobelec_extension.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "sobelec_extension.utils.before_app_install"
# after_app_install = "sobelec_extension.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "sobelec_extension.utils.before_app_uninstall"
# after_app_uninstall = "sobelec_extension.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "sobelec_extension.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

# override_doctype_class = {
# 	"ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
# 	}
# }

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"sobelec_extension.tasks.all"
# 	],
# 	"daily": [
# 		"sobelec_extension.tasks.daily"
# 	],
# 	"hourly": [
# 		"sobelec_extension.tasks.hourly"
# 	],
# 	"weekly": [
# 		"sobelec_extension.tasks.weekly"
# 	],
# 	"monthly": [
# 		"sobelec_extension.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "sobelec_extension.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "sobelec_extension.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "sobelec_extension.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["sobelec_extension.utils.before_request"]
# after_request = ["sobelec_extension.utils.after_request"]

# Job Events
# ----------
# before_job = ["sobelec_extension.utils.before_job"]
# after_job = ["sobelec_extension.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"sobelec_extension.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }

app_include_js = [
    "sobelec_extension/public/js/item_details_dialog.js"
]

