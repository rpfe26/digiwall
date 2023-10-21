<template>
	<div id="page" v-if="acces">
		<div id="accueil">
			<div id="langues">
				<span class="bouton" role="button" tabindex="0" :class="{'selectionne': langue === 'fr'}" @click="modifierLangue('fr')">FR</span>
				<span class="bouton" role="button" tabindex="0" :class="{'selectionne': langue === 'es'}" @click="modifierLangue('es')">ES</span>
				<span class="bouton" role="button" tabindex="0" :class="{'selectionne': langue === 'it'}" @click="modifierLangue('it')">IT</span>
				<span class="bouton" role="button" tabindex="0" :class="{'selectionne': langue === 'hr'}" @click="modifierLangue('hr')">HR</span>
				<span class="bouton" role="button" tabindex="0" :class="{'selectionne': langue === 'en'}" @click="modifierLangue('en')">EN</span>
			</div>
			<div id="conteneur">
				<h1>
					<span>{{ $t('maintenance') }}</span>
				</h1>
				<div class="conteneur actions">
					<span class="bouton maintenance" role="button" tabindex="0" @click="activerMaintenance" v-if="maintenance === false">{{ $t('activerMaintenance') }}</span>
					<span class="bouton maintenance" role="button" tabindex="0" @click="desactiverMaintenance" v-else>{{ $t('desactiverMaintenance') }}</span>
				</div>
				<h1>
					<span>{{ $t('modifierMotDePasseUtilisateur') }}</span>
				</h1>
				<div class="conteneur">
					<label>{{ $t('identifiant') }}</label>
					<input type="text" v-model.lazy="identifiant">
				</div>
				<div class="conteneur">
					<label>{{ $t('email') }}</label>
					<input type="text" v-model.lazy="email">
				</div>
				<div class="conteneur">
					<label>{{ $t('motDePasse') }}</label>
					<input type="text" maxlength="48" v-model.lazy="motdepasse">
				</div>
				<div class="conteneur actions">
					<span class="bouton" role="button" tabindex="0" @click="modifierMotDePasse">{{ $t('valider') }}</span>
				</div>
				<h1>
					<span>{{ $t('recupererDonneesMur') }}</span>
				</h1>
				<div class="conteneur">
					<label>{{ $t('numeroMur') }}</label>
					<input type="number" v-model.lazy="murId">
				</div>
				<div class="conteneur" v-if="donneesMur !== ''">
					<span class="donnees">{{ donneesMur }}</span>
				</div>
				<div class="conteneur actions">
					<span class="bouton" role="button" tabindex="0" @click="recupererDonneesMur">{{ $t('valider') }}</span>
				</div>
				<h1>
					<span>{{ $t('modifierDonneesMur') }}</span>
				</h1>
				<div class="conteneur">
					<label>{{ $t('numeroMur') }}</label>
					<input type="number" v-model.lazy="murIdM">
				</div>
				<div class="conteneur">
					<label>{{ $t('champ') }}</label>
					<select @change="champ = $event.target.value">
						<option value="" :selected="champ === ''">-</option>
						<option value="code" :selected="champ === 'code'">{{ $t('codeAcces') }}</option>
						<option value="motdepasse" :selected="champ === 'motdepasse'">{{ $t('motDePasse') }}</option>
					</select>
				</div>
				<div class="conteneur">
					<label>{{ $t('valeur') }}</label>
					<input type="text" v-model.lazy="valeur" :maxlength="18" v-if="champ === 'code'">
					<input type="text" v-model.lazy="valeur" v-else>
				</div>
				<div class="conteneur actions">
					<span class="bouton" role="button" tabindex="0" @click="modifierDonneesMur">{{ $t('valider') }}</span>
				</div>
				<h1>
					<span>{{ $t('exporterMur') }}</span>
				</h1>
				<div class="conteneur">
					<label>{{ $t('numeroMur') }}</label>
					<input type="number" v-model.lazy="murIdE">
				</div>
				<div class="conteneur actions">
					<span class="bouton" role="button" tabindex="0" @click="exporterMur">{{ $t('valider') }}</span>
				</div>
				<h1>
					<span>{{ $t('rattacherMur') }}</span>
				</h1>
				<div class="conteneur">
					<label>{{ $t('numeroMur') }}</label>
					<input type="number" v-model.lazy="murIdR">
				</div>
				<div class="conteneur">
					<label>{{ $t('identifiantDestination') }}</label>
					<input type="text" v-model.lazy="identifiantRa">
				</div>
				<div class="conteneur actions">
					<span class="bouton" role="button" tabindex="0" @click="modale = 'rattacher-mur'">{{ $t('valider') }}</span>
				</div>
				<h1>
					<span>{{ $t('supprimerMur') }}</span>
				</h1>
				<div class="conteneur">
					<label>{{ $t('numeroMur') }}</label>
					<input type="number" v-model.lazy="murIdS">
				</div>
				<div class="conteneur">
					<div class="conteneur-interrupteur">
						<span>{{ $t('supprimerFichiersServeur') }}</span>
						<label class="bouton-interrupteur">
							<input type="checkbox" :checked="suppressionFichiers" @change="modifierSuppressionFichiers">
							<span class="barre" />
						</label>
					</div>
				</div>
				<div class="conteneur actions">
					<span class="bouton" role="button" tabindex="0" @click="modale = 'supprimer-mur'">{{ $t('valider') }}</span>
				</div>
				<h1>
					<span>{{ $t('recupererDonneesUtilisateur') }}</span>
				</h1>
				<div class="conteneur">
					<label>{{ $t('identifiant') }}</label>
					<input type="text" v-model.lazy="identifiantR">
				</div>
				<div class="conteneur" v-if="donneesUtilisateur !== ''">
					<span class="donnees">{{ donneesUtilisateur }}</span>
				</div>
				<div class="conteneur actions">
					<span class="bouton" role="button" tabindex="0" @click="recupererDonneesUtilisateur">{{ $t('valider') }}</span>
				</div>
				<h1>
					<span>{{ $t('transfererCompte') }}</span>
				</h1>
				<div class="conteneur">
					<label>{{ $t('identifiantCompteATransferer') }}</label>
					<input type="text" v-model.lazy="identifiantO">
				</div>
				<div class="conteneur">
					<label>{{ $t('identifiantDestination') }}</label>
					<input type="text" v-model.lazy="identifiantT">
				</div>
				<div class="conteneur actions">
					<span class="bouton" role="button" tabindex="0" @click="modale = 'transferer-compte'">{{ $t('valider') }}</span>
				</div>
				<h1>
					<span>{{ $t('supprimerCompte') }}</span>
				</h1>
				<div class="conteneur">
					<label>{{ $t('identifiant') }}</label>
					<input type="text" v-model.lazy="identifiantS">
				</div>
				<div class="conteneur actions">
					<span class="bouton" role="button" tabindex="0" @click="modale = 'supprimer-compte'">{{ $t('valider') }}</span>
				</div>
			</div>
		</div>

		<div id="conteneur-message" class="conteneur-modale" v-if="modale !== ''">
			<div class="modale">
				<div class="conteneur">
					<div class="contenu">
						<div class="message" v-html="$t('confirmationRattacherMur')" v-if="modale === 'rattacher-mur'" />
						<div class="message" v-html="$t('confirmationSupprimerMur')" v-else-if="modale === 'supprimer-mur'" />
						<div class="message" v-html="$t('confirmationTransfererCompte')" v-else-if="modale === 'transferer-compte'" />
						<div class="message" v-html="$t('confirmationSupprimerCompteAdmin')" v-else-if="modale === 'supprimer-compte'" />
						<div class="actions">
							<span role="button" tabindex="0" class="bouton" @click="modale = ''">{{ $t('non') }}</span>
							<span role="button" tabindex="0" class="bouton" @click="rattacherMur" v-if="modale === 'rattacher-mur'">{{ $t('oui') }}</span>
							<span role="button" tabindex="0" class="bouton" @click="supprimerMur" v-else-if="modale === 'supprimer-mur'">{{ $t('oui') }}</span>
							<span role="button" tabindex="0" class="bouton" @click="transfererCompte" v-else-if="modale === 'transferer-compte'">{{ $t('oui') }}</span>
							<span role="button" tabindex="0" class="bouton" @click="supprimerCompte" v-else-if="modale === 'supprimer-compte'">{{ $t('oui') }}</span>
						</div>
					</div>
				</div>
			</div>
		</div>

		<Notification :notification="notification" @fermer="notification = ''" v-if="notification !== ''" />

		<Message :message="message" @fermer="message = ''" v-if="message !== ''" />

		<Chargement v-if="chargement" />

		<ChargementPage v-if="chargementPage" />
	</div>
</template>

<script>
import axios from 'axios'
import fileSaver from 'file-saver'
const { saveAs } = fileSaver
import ChargementPage from '#root/components/chargement-page.vue'
import Chargement from '#root/components/chargement.vue'
import Message from '#root/components/message.vue'
import Notification from '#root/components/notification.vue'

export default {
	name: 'Admin',
	components: {
		ChargementPage,
		Chargement,
		Message,
		Notification
	},
	data () {
		return {
			chargementPage: true,
			chargement: false,
			message: '',
			notification: '',
			acces: false,
			admin: '',
			modale: '',
			identifiant: '',
			email: '',
			motdepasse: '',
			murId: '',
			murIdS: '',
			murIdM: '',
			murIdE: '',
			murIdR: '',
			donneesMur: '',
			identifiantS: '',
			identifiantR: '',
			identifiantO: '',
			identifiantT: '',
			identifiantRa: '',
			donneesUtilisateur: '',
			champ: '',
			valeur: '',
			maintenance: false,
			suppressionFichiers: true,
			hote: this.$pageContext.pageProps.hote,
			langue: this.$pageContext.pageProps.langue
		}
	},
	created () {
		this.$i18n.locale = this.langue
		this.$socket.emit('verifiermaintenance')
		this.$socket.on('verifiermaintenance', function (valeur) {
			this.maintenance = valeur
		}.bind(this))
	},
	mounted () {
		const motdepasse = prompt(this.$t('motDePasse'), '')
		if (motdepasse === import.meta.env.VITE_ADMIN_PASSWORD) {
			this.acces = true
			this.admin = motdepasse
			this.chargementPage = false
		}
	},
	methods: {
		modifierLangue (langue) {
			if (this.langue !== langue) {
				axios.post(this.hote + '/api/modifier-langue', {
					identifiant: this.identifiant,
					langue: langue
				}).then(function () {
					this.$i18n.locale = langue
					document.getElementsByTagName('html')[0].setAttribute('lang', langue)
					this.langue = langue
					this.notification = this.$t('langueModifiee')
				}.bind(this)).catch(function () {
					this.message = this.$t('erreurCommunicationServeur')
				}.bind(this))
			}
		},
		activerMaintenance () {
			this.$socket.emit('activermaintenance')
		},
		desactiverMaintenance () {
			this.$socket.emit('desactivermaintenance')
		},
		modifierMotDePasse () {
			if (this.motdepasse !== '' && (this.identifiant !== '' || this.email !== '')) {
				this.chargement = true
				axios.post(this.hote + '/api/modifier-mot-de-passe-admin', {
					admin: this.admin,
					identifiant: this.identifiant,
					email: this.email,
					motdepasse: this.motdepasse
				}).then(function (reponse) {
					this.chargement = false
					const donnees = reponse.data
					if (donnees === 'erreur') {
						this.message = this.$t('erreurActionServeur')
					} else if (donnees === 'identifiant_non_valide') {
						this.message = this.$t('identifiantNonValide')
					} else if (donnees === 'email_non_valide') {
						this.message = this.$t('erreurEmail')
					} else {
						this.notification = this.$t('motDePasseModifie')
						if (donnees !== 'motdepasse_modifie') {
							this.message = this.$t('identifiant') + ' : ' + donnees
						}
					}
					this.identifiant = ''
					this.motdepasse = ''
					this.email = ''
				}.bind(this)).catch(function () {
					this.chargement = false
					this.message = this.$t('erreurCommunicationServeur')
				}.bind(this))
			}
		},
		recupererDonneesMur () {
			if (this.murId !== '') {
				this.chargement = true
				axios.post(this.hote + '/api/recuperer-donnees-mur-admin', {
					murId: this.murId
				}).then(function (reponse) {
					this.chargement = false
					const donnees = reponse.data
					if (donnees === 'erreur') {
						this.message = this.$t('erreurActionServeur')
					} else if (donnees === 'mur_inexistant') {
						this.message = this.$t('murInexistant')
					} else {
						this.donneesMur = donnees
					}
					this.murId = ''
				}.bind(this)).catch(function () {
					this.chargement = false
					this.message = this.$t('erreurCommunicationServeur')
				}.bind(this))
			}
		},
		modifierDonneesMur () {
			if (this.murIdM !== '' && this.champ !== '' && this.valeur !== '') {
				this.chargement = true
				axios.post(this.hote + '/api/modifier-donnees-mur-admin', {
					murId: this.murIdM,
					champ: this.champ,
					valeur: this.valeur
				}).then(function (reponse) {
					this.chargement = false
					const donnees = reponse.data
					if (donnees === 'erreur') {
						this.message = this.$t('erreurActionServeur')
					} else if (donnees === 'mur_inexistant') {
						this.message = this.$t('murInexistant')
					} else {
						this.notification = this.$t('donneesModifiees')
					}
					this.murIdM = ''
					this.champ = ''
					this.valeur = ''
				}.bind(this)).catch(function () {
					this.chargement = false
					this.message = this.$t('erreurCommunicationServeur')
				}.bind(this))
			}
		},
		modifierSuppressionFichiers (event) {
			if (event.target.checked === true) {
				this.suppressionFichiers = true
			} else {
				this.suppressionFichiers = false
			}
		},
		exporterMur () {
			if (this.murIdE !== '') {
				this.chargement = true
				axios.post(this.hote + '/api/exporter-mur', {
					murId: this.murIdE,
					identifiant: '',
					admin: this.admin
				}).then(function (reponse) {
					const donnees = reponse.data
					if (donnees === 'erreur_export') {
						this.chargement = false
						this.message = this.$t('erreurExportMur')
					} else {
						saveAs('/temp/' + donnees, 'mur-' + this.murIdE + '.zip')
						this.chargement = false
						this.murIdE = ''
					}
				}.bind(this)).catch(function () {
					this.chargement = false
					this.murIdE = ''
					this.message = this.$t('erreurCommunicationServeur')
				}.bind(this))
			}
		},
		rattacherMur () {
			if (this.murIdR !== '' && this.identifiantRa !== '') {
				this.modale = ''
				this.chargement = true
				axios.post(this.hote + '/api/rattacher-mur', {
					murId: this.murIdR,
					identifiant: this.identifiantRa
				}).then(function (reponse) {
					this.chargement = false
					const donnees = reponse.data
					if (donnees === 'erreur') {
						this.message = this.$t('erreurActionServeur')
					} else if (donnees === 'utilisateur_inexistant') {
						this.message = this.$t('utilisateurInexistant')
					} else if (donnees === 'mur_inexistant') {
						this.message = this.$t('murInexistant')
					} else if (donnees === 'mur_cree_avec_compte') {
						this.message = this.$t('murCreeAvecCompte')
					} else {
						this.notification = this.$t('murTransfere')
						this.murIdR = ''
						this.identifiantRa = ''
					}
				}.bind(this)).catch(function () {
					this.chargement = false
					this.message = this.$t('erreurCommunicationServeur')
				}.bind(this))
			}
		},
		supprimerMur () {
			if (this.murIdS !== '') {
				this.modale = ''
				this.chargement = true
				axios.post(this.hote + '/api/recuperer-donnees-mur-admin', {
					murId: this.murIdS
				}).then(function (reponse) {
					this.chargement = false
					const donnees = reponse.data
					if (donnees === 'erreur') {
						this.message = this.$t('erreurActionServeur')
					} else if (donnees === 'mur_inexistant') {
						this.message = this.$t('murInexistant')
					} else {
						const identifiant = donnees.identifiant
						axios.post(this.hote + '/api/supprimer-mur', {
							murId: this.murIdS,
							type: 'mur',
							identifiant: identifiant,
							admin: this.admin,
							suppressionFichiers: this.suppressionFichiers
						}).then(function (reponse) {
							this.chargement = false
							const donnees = reponse.data
							if (donnees === 'erreur_suppression') {
								this.message = this.$t('erreurSuppressionMur')
							} else {
								this.notification = this.$t('murSupprime')
								this.murIdS = ''
								this.suppressionFichiers = true
							}
						}.bind(this)).catch(function () {
							this.chargement = false
							this.murIdS = ''
							this.suppressionFichiers = true
							this.message = this.$t('erreurCommunicationServeur')
						}.bind(this))
					}
				}.bind(this)).catch(function () {
					this.chargement = false
					this.murIdS = ''
					this.suppressionFichiers = true
					this.message = this.$t('erreurCommunicationServeur')
				}.bind(this))
			}
		},
		recupererDonneesUtilisateur () {
			if (this.identifiantR !== '') {
				this.chargement = true
				axios.post(this.hote + '/api/recuperer-donnees-utilisateur-admin', {
					identifiant: this.identifiantR
				}).then(function (reponse) {
					this.chargement = false
					const donnees = reponse.data
					if (donnees === 'erreur') {
						this.message = this.$t('erreurActionServeur')
					} else if (donnees === 'utilisateur_inexistant') {
						this.message = this.$t('utilisateurInexistant')
					} else {
						this.donneesUtilisateur = donnees
					}
					this.identifiantR = ''
				}.bind(this)).catch(function () {
					this.chargement = false
					this.message = this.$t('erreurCommunicationServeur')
				}.bind(this))
			}
		},
		transfererCompte () {
			if (this.identifiantO !== '' && this.identifiantT !== '') {
				this.modale = ''
				this.chargement = true
				axios.post(this.hote + '/api/transferer-compte', {
					identifiant: this.identifiantO,
					nouvelIdentifiant: this.identifiantT
				}).then(function (reponse) {
					this.chargement = false
					const donnees = reponse.data
					if (donnees === 'erreur') {
						this.message = this.$t('erreurActionServeur')
					} else if (donnees === 'utilisateur_inexistant') {
						this.message = this.$t('utilisateursInexistants')
					} else {
						this.notification = this.$t('compteTransfere')
						this.identifiantO = ''
						this.identifiantT = ''
					}
				}.bind(this)).catch(function () {
					this.chargement = false
					this.message = this.$t('erreurCommunicationServeur')
				}.bind(this))
			}
		},
		supprimerCompte () {
			if (this.identifiantS !== '') {
				this.modale = ''
				this.chargement = true
				axios.post(this.hote + '/api/supprimer-compte', {
					identifiant: this.identifiantS,
					admin: this.admin
				}).then(function (reponse) {
					this.chargement = false
					const donnees = reponse.data
					if (donnees === 'erreur') {
						this.message = this.$t('erreurActionServeur')
					} else {
						this.notification = this.$t('compteSupprime')
						this.identifiantS = ''
					}
				}.bind(this)).catch(function () {
					this.chargement = false
					this.message = this.$t('erreurCommunicationServeur')
				}.bind(this))
			}
		}
	}
}
</script>

<style scoped>
#page,
#accueil {
	width: 100%;
	height: 100%;
}

#page {
	overflow: auto;
}

#langues {
	position: fixed;
	display: flex;
	top: 1rem;
	right: 0.5rem;
	z-index: 10;
}

#langues span {
    display: flex;
    justify-content: center;
	align-items: center;
	font-size: 1.4rem;
    width: 3rem;
	height: 3rem;
	background: #fff;
    border-radius: 50%;
    border: 1px solid #ddd;
    margin-right: 1rem;
	cursor: pointer;
}

#langues span.selectionne {
    background: #242f3d;
    color: #fff;
    border: 1px solid #222;
    cursor: default;
}

#conteneur {
    width: 100%;
	max-width: 500px;
	margin: auto;
	padding-top: 5em;
	padding-bottom: 5em;
}

#conteneur h1 {
    font-family: 'HKGroteskWide-ExtraBold', 'HKGrotesk-ExtraBold', sans-serif;
    font-size: 2rem;
	font-weight: 900;
	margin: 0 1.5rem 0.85em;
    line-height: 1.4;
}

#conteneur .conteneur {
    margin: 2rem 1.5rem;
}

#conteneur .conteneur-bouton {
	font-size: 0;
}

#conteneur .conteneur label {
    font-size: 14px;
    display: block;
	margin-bottom: 10px;
	line-height: 1.15;
	font-weight: 700;
}

#conteneur .conteneur select,
#conteneur .conteneur input {
	display: block;
    width: 100%;
    font-size: 16px;
    border: 1px solid #ddd;
    border-radius: 4px;
	padding: 7px 15px;
	line-height: 1.5;
}

#conteneur .conteneur select {
	background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" height="14" viewBox="0 0 29 14" width="29"><path fill="%23000000" d="M9.37727 3.625l5.08154 6.93523L19.54036 3.625" /></svg>') center right no-repeat;
	padding-right: 30px;
}

#conteneur .conteneur div {
    margin-bottom: 10px;
}

#conteneur .conteneur div:not(.conteneur-interrupteur):last-child {
    margin-bottom: 3rem;
}

#conteneur .conteneur .donnees {
	user-select: text!important;
	-webkit-user-select: text!important;
	-webkit-touch-callout: default!important;
}

#conteneur .actions {
	display: flex;
	justify-content: center;
	flex-wrap: wrap;
	margin-bottom: 4rem;
}

#conteneur .actions .bouton {
	display: inline-block;
	width: 180px;
    line-height: 1;
    font-size: 1em;
    font-weight: 700;
    text-transform: uppercase;
	text-align: center;
	padding: 1em 1.5em;
	margin-right: 1em;
    border: 2px solid #00ced1;
	border-radius: 2em;
    background: #46fbff;
	cursor: pointer;
    transition: all 0.1s ease-in;
}

#conteneur .actions .bouton.maintenance {
	width: 100%;
}

#conteneur .actions .bouton.maintenance:first-child {
	margin-right: 0;
	margin-bottom: 2rem;
}

#conteneur .actions .bouton:hover {
    color: #fff;
	text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.3);
	background: #00ced1;
}

#conteneur .actions .bouton:last-child {
	margin-right: 0;
}

#conteneur .conteneur-interrupteur {
	display: flex;
	justify-content: space-between;
	margin-bottom: 1rem;
	line-height: 2.2rem;
}

#conteneur .conteneur-interrupteur > span {
	font-size: 16px;
}

#conteneur .bouton-interrupteur {
	position: relative;
	display: inline-block!important;
	width: 3.8rem!important;
	height: 2.2rem;
	margin: 0!important;
}

#conteneur .bouton-interrupteur input {
	opacity: 0;
	width: 0;
	height: 0;
}

#conteneur .bouton-interrupteur .barre {
	position: absolute;
	cursor: pointer;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background-color: #ccc;
	transition: 0.2s;
	border-radius: 3rem;
}

#conteneur .bouton-interrupteur .barre:before {
	position: absolute;
	content: '';
	height: 1.6rem;
	width: 1.6rem;
	left: 0.3rem;
	bottom: 0.3rem;
	background-color: #fff;
	transition: 0.2s;
	border-radius: 50%;
}

#conteneur .bouton-interrupteur input:checked + .barre {
	background-color: #00ced1;
}

#conteneur .bouton-interrupteur input:focus + .barre {
	box-shadow: 0 0 1px #00ced1;
}

#conteneur .bouton-interrupteur input:checked + .barre:before {
	transform: translateX(1.6rem);
}

@media screen and (max-width: 359px) {
	#conteneur .actions .bouton {
		font-size: 0.75em!important;
		width: 130px;
		padding: 1em 0.5em;
	}
}

@media screen and (min-width: 360px) and (max-width: 599px) {
	#conteneur .actions .bouton {
		width: 145px;
	}
}

@media screen and (max-width: 399px) {
	#conteneur h1 span {
		display: block;
	}
}

@media screen and (max-width: 599px) {
	#conteneur h1 {
		font-size: 2em;
		margin-bottom: 1em;
	}

	#conteneur .actions .bouton {
		font-size: 0.85em;
		margin-bottom: 1em;
	}
}

@media screen and (max-width: 850px) and (max-height: 500px) {
	#conteneur h1 {
		font-size: 2em;
		margin-bottom: 1em;
	}

	#conteneur .actions .bouton {
		font-size: 0.85em!important;
	}
}
</style>

<style>
#message .message {
	user-select: text!important;
}
</style>
