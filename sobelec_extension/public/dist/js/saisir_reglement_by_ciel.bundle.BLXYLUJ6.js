(()=>{var r=class{constructor(e){this.wrapper=e,this.page_id=`reglement_${Date.now()}_${Math.random().toString(36).substr(2,9)}`,this.filters={party_type:"Customer",party:"",company:frappe.defaults.get_default("company")},this.selected_invoices=new Set,this.payment_data={mode_of_payment:"",account:"",reference_no:"",reference_date:frappe.datetime.nowdate(),amount:0},this.init()}async init(){try{this.setup_page_structure(),this.setup_filters(),this.setup_event_handlers(),await this.load_data(),this.show_success_message("Interface initialis\xE9e avec succ\xE8s")}catch(e){this.handle_error("Erreur d'initialisation",e)}}setup_page_structure(){this.wrapper.innerHTML=`
            <div class="saisir-reglement-container">
                <!-- Header Section -->
                <div class="page-header">
                    <div class="row">
                        <div class="col-md-8">
                            <h2><i class="fa fa-money"></i> Saisie des r\xE8glements</h2>
                            <p class="text-muted">Interface de saisie des r\xE8glements style Ciel</p>
                        </div>
                    </div>
                </div>

                <!-- Filters Section -->
                <div class="filters-section card">
                    <div class="card-header">
                        <h4><i class="fa fa-filter"></i> S\xE9lection</h4>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-4">
                                <label>Type</label>
                                <select class="form-control" id="party-type-${this.page_id}">
                                    <option value="Customer">Client</option>
                                    <option value="Supplier">Fournisseur</option>
                                </select>
                            </div>
                            <div class="col-md-8">
                                <label>S\xE9lectionner</label>
                                <div id="party-field-${this.page_id}"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Stats Section -->
                <div class="stats-section">
                    <div class="row">
                        <div class="col-md-4">
                            <div class="stat-card">
                                <div class="stat-label">Solde total</div>
                                <div class="stat-value" id="total-balance-${this.page_id}">0.00</div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="stat-card">
                                <div class="stat-label">Factures impay\xE9es</div>
                                <div class="stat-value" id="unpaid-count-${this.page_id}">0</div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="stat-card">
                                <div class="stat-label">Dernier r\xE8glement</div>
                                <div class="stat-value" id="last-payment-${this.page_id}">-</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Invoices Section -->
                <div class="invoices-section card">
                    <div class="card-header">
                        <h4><i class="fa fa-file-text"></i> Factures</h4>
                    </div>
                    <div class="card-body">
                        <div class="table-responsive">
                            <table class="table table-bordered" id="invoices-${this.page_id}">
                                <thead>
                                    <tr>
                                        <th width="30px">
                                            <input type="checkbox" class="select-all"/>
                                        </th>
                                        <th>N\xB0 Facture</th>
                                        <th>Date</th>
                                        <th>\xC9ch\xE9ance</th>
                                        <th class="text-right">Montant total</th>
                                        <th class="text-right">Pay\xE9</th>
                                        <th class="text-right">Solde</th>
                                        <th>Statut</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td colspan="8" class="text-center text-muted">
                                            S\xE9lectionnez un client/fournisseur
                                        </td>
                                    </tr>
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <th colspan="4">Total s\xE9lectionn\xE9</th>
                                        <th class="text-right" id="selected-total-${this.page_id}">0.00</th>
                                        <th class="text-right" id="selected-paid-${this.page_id}">0.00</th>
                                        <th class="text-right" id="selected-balance-${this.page_id}">0.00</th>
                                        <th></th>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- Payment Section -->
                <div class="payment-section card">
                    <div class="card-header">
                        <h4><i class="fa fa-credit-card"></i> Saisie du r\xE8glement</h4>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-3">
                                <div class="form-group">
                                    <label>Mode de paiement</label>
                                    <div class="mode-of-payment-field-${this.page_id}" id="mode-of-payment-field-${this.page_id}"></div>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="form-group">
                                    <label>Compte</label>
                                    <div class="account-field-${this.page_id}"id="account-field-${this.page_id}"></div>
                                </div>
                            </div>
                            <div class="col-md-2">
                                <div class="form-group">
                                    <label>Date</label>
                                    <input type="date" class="form-control payment-date"
                                           value="${frappe.datetime.nowdate()}"/>
                                </div>
                            </div>
                            <div class="col-md-2">
                                <div class="form-group">
                                    <label>R\xE9f\xE9rence</label>
                                    <input type="text" class="form-control payment-reference"
                                           placeholder="N\xB0 ch\xE8que..."/>
                                </div>
                            </div>
                            <div class="col-md-2">
                                <div class="form-group">
                                    <label>Montant</label>
                                    <input type="number" class="form-control text-right payment-amount"
                                           step="0.01"/>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="card-footer text-right">
                        <button class="btn btn-secondary" id="draft-payment-${this.page_id}">
                            <i class="fa fa-save"></i> Enregistrer brouillon
                        </button>
                        <button class="btn btn-primary" id="submit-payment-${this.page_id}">
                            <i class="fa fa-check"></i> Valider r\xE8glement
                        </button>
                    </div>
                </div>
            </div>
        `,this.setup_styles()}setup_styles(){let e=document.createElement("style");e.textContent=`
            .saisir-reglement-container {
                padding: 15px;
            }

            .card {
                margin-bottom: 20px;
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius);
            }

            .card-header {
                background-color: var(--fg-color);
                padding: 10px 15px;
                border-bottom: 1px solid var(--border-color);
            }

            .card-header h4 {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
            }

            .card-body {
                padding: 15px;
                background-color: var(--fg-color);
            }

            .card-footer {
                padding: 15px;
                background-color: var(--fg-color);
                border-top: 1px solid var(--border-color);
            }

            .stats-section {
                margin-bottom: 20px;
            }

            .stat-card {
                background: var(--fg-color);
                padding: 15px;
                border-radius: var(--border-radius);
                box-shadow: var(--card-shadow);
            }

            .stat-label {
                color: var(--text-muted);
                font-size: 0.9em;
            }

            .stat-value {
                font-size: 1.5em;
                font-weight: bold;
                color: var(--text-color);
            }

            .table thead th {
                background: var(--fg-color);
                border-bottom: 2px solid var(--border-color);
            }

            .table tbody tr.paid {
                background-color: var(--green-50);
            }

            .table tbody tr.overdue {
                background-color: var(--red-50);
            }
        `,document.head.appendChild(e)}setup_filters(){this.party_field=frappe.ui.form.make_control({parent:$(`#party-field-${this.page_id}`),df:{fieldtype:"Link",options:this.filters.party_type,label:"",placeholder:"Rechercher...",get_query:()=>({filters:{disabled:0}}),change:()=>{this.filters.party=this.party_field.get_value(),this.load_data()}},render_input:!0}),this.mode_of_payment_field=frappe.ui.form.make_control({parent:$(`#mode-of-payment-field-${this.page_id}`),df:{fieldtype:"Link",options:"Mode of Payment",label:"",placeholder:"S\xE9lectionner...",get_query:()=>({filters:{enabled:1}}),change:()=>{this.payment_data.mode_of_payment=this.mode_of_payment_field.get_value()}},render_input:!0}),this.account_field=frappe.ui.form.make_control({parent:$(`.account-field-${this.page_id}`),df:{fieldtype:"Link",options:"Account",label:"",placeholder:"S\xE9lectionner...",get_query:()=>({filters:{account_type:["in",["Bank","Cash"]],is_group:0,company:this.filters.company}}),change:()=>{this.payment_data.account=this.account_field.get_value()}},render_input:!0})}setup_payment_fields(){this.mode_of_payment_field=frappe.ui.form.make_control({parent:$(`#mode-of-payment-field-${this.page_id}`),df:{fieldtype:"Link",options:"Mode of Payment",label:"",placeholder:"S\xE9lectionner...",get_query:()=>({filters:{enabled:1}}),change:()=>{this.payment_data.mode_of_payment=this.mode_of_payment_field.get_value()}},render_input:!0}),this.account_field=frappe.ui.form.make_control({parent:$(`.account-field-${this.page_id}`),df:{fieldtype:"Link",options:"Account",label:"",placeholder:"S\xE9lectionner...",get_query:()=>({filters:{account_type:["in",["Bank","Cash"]],is_group:0,company:this.filters.company}}),change:()=>{this.payment_data.account=this.account_field.get_value()}},render_input:!0})}setup_event_handlers(){$(`#party-type-${this.page_id}`).on("change",e=>{this.filters.party_type=$(e.target).val(),this.party_field.df.options=this.filters.party_type,this.party_field.refresh(),this.party_field.set_value(""),this.clear_data()}),this.setup_invoice_selection_handlers(),this.setup_payment_handlers(),$(`#draft-payment-${this.page_id}`).on("click",()=>this.save_payment(!1)),$(`#submit-payment-${this.page_id}`).on("click",()=>this.save_payment(!0))}setup_invoice_selection_handlers(){$(".select-all",this.wrapper).on("change",e=>{let t=$(e.target).is(":checked");$(".invoice-select",this.wrapper).prop("checked",t).trigger("change")}),$(this.wrapper).on("change",".invoice-select",e=>{let t=$(e.target),a=t.data("name"),i=parseFloat(t.data("amount"));t.is(":checked")?this.selected_invoices.add({name:a,amount:i}):this.selected_invoices.delete(a),this.update_selected_total()})}setup_payment_handlers(){$(".payment-reference, .payment-date",this.wrapper).on("change",()=>this.update_payment_data()),$(".payment-amount",this.wrapper).on("input",e=>{this.payment_data.amount=parseFloat($(e.target).val())||0})}async load_data(){if(!this.filters.party){this.clear_data();return}this.show_loading();try{let e=await frappe.call({method:"sobelec_extension.api_reglement.get_open_invoices",args:this.filters});e.message&&(this.render_invoices(e.message),this.update_stats(e.message))}catch(e){this.handle_error("Erreur de chargement",e)}finally{this.hide_loading()}}render_invoices(e){let t=$("#invoices-"+this.page_id+" tbody");if(!e.length){t.html(`
                <tr>
                    <td colspan="8" class="text-center text-muted">
                        Aucune facture impay\xE9e trouv\xE9e
                    </td>
                </tr>
            `);return}let a=e.map(i=>{let s=this.get_status_html(i);return`
                <tr class="${this.get_status_class(i)}">
                    <td>
                        <input type="checkbox" class="invoice-select"
                               data-name="${i.name}"
                               data-amount="${i.outstanding_amount}"/>
                    </td>
                    <td>${i.name}</td>
                    <td>${frappe.datetime.str_to_user(i.posting_date)}</td>
                    <td>${frappe.datetime.str_to_user(i.due_date)}</td>
                    <td class="text-right">${format_currency(i.grand_total)}</td>
                    <td class="text-right">${format_currency(i.paid_amount)}</td>
                    <td class="text-right">${format_currency(i.outstanding_amount)}</td>
                    <td>${s}</td>
                </tr>
            `}).join("");t.html(a)}get_status_html(e){let t="",a="";return e.outstanding_amount<=0?(t=__("Pay\xE9e"),a="green"):e.paid_amount>0?(t=__("Partiel"),a="orange"):frappe.datetime.get_diff(frappe.datetime.nowdate(),e.due_date)>0?(t=__("En retard"),a="red"):(t=__("Ouverte"),a="blue"),`<span class="indicator-pill ${a} ellipsis">${t}</span>`}get_status_class(e){return e.outstanding_amount<=0?"paid":frappe.datetime.get_diff(frappe.datetime.nowdate(),e.due_date)>0?"overdue":""}update_stats(e){let t=e.reduce((i,s)=>i+s.outstanding_amount,0),a=e.length;$(`#total-balance-${this.page_id}`).text(format_currency(t)),$(`#unpaid-count-${this.page_id}`).text(a)}update_selected_total(){let e=Array.from(this.selected_invoices).reduce((t,a)=>t+a.amount,0);$(`#selected-total-${this.page_id}`).text(format_currency(e)),$(".payment-amount",this.wrapper).val(e),this.payment_data.amount=e}update_payment_data(){this.payment_data={mode_of_payment:this.mode_of_payment_field.get_value(),account:this.account_field.get_value(),reference_no:$(".payment-reference",this.wrapper).val(),reference_date:$(".payment-date",this.wrapper).val(),amount:parseFloat($(".payment-amount",this.wrapper).val())||0}}save_payment(e=!1){!this.validate_payment()||frappe.call({method:"sobelec_extension.api_reglement.create_payment_entry",args:{party_type:this.filters.party_type,party:this.filters.party,payment_data:this.payment_data,invoices:Array.from(this.selected_invoices),submit:e},callback:t=>{t.message&&(this.show_success_message(e?"R\xE8glement valid\xE9":"Brouillon enregistr\xE9"),frappe.set_route("Form","Payment Entry",t.message))}})}validate_payment(){return this.filters.party?this.selected_invoices.size?this.payment_data.mode_of_payment?this.payment_data.account?this.payment_data.amount?!0:(frappe.throw(__("Montant requis")),!1):(frappe.throw(__("Compte bancaire requis")),!1):(frappe.throw(__("Mode de paiement requis")),!1):(frappe.throw(__("Veuillez s\xE9lectionner au moins une facture")),!1):(frappe.throw(__("Veuillez s\xE9lectionner un client/fournisseur")),!1)}clear_data(){$("#invoices-"+this.page_id+" tbody").html(`
            <tr>
                <td colspan="8" class="text-center text-muted">
                    S\xE9lectionnez un client/fournisseur
                </td>
            </tr>
        `),this.selected_invoices.clear(),this.update_selected_total(),this.update_stats([])}show_loading(){this.wrapper.classList.add("loading"),this.$loading||(this.$loading=$(`<div class="loading-overlay">
                <div class="loading-spinner"></div>
            </div>`).appendTo(this.wrapper)),this.$loading.show()}hide_loading(){this.wrapper.classList.remove("loading"),this.$loading&&this.$loading.hide()}show_success_message(e){frappe.show_alert({message:__(e),indicator:"green"})}handle_error(e,t){console.error(e,t),frappe.msgprint({title:__(e),indicator:"red",message:__(t.message||t.toString())})}};frappe.provide("frappe.saisir_reglement_by_ciel");frappe.saisir_reglement_by_ciel.SaisirReglementManager=r;})();
//# sourceMappingURL=saisir_reglement_by_ciel.bundle.BLXYLUJ6.js.map
