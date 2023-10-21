import axios from 'axios'
import imagesLoaded from 'imagesloaded'
import pell from 'pell'
import linkifyHtml from 'linkify-html'
import stripTags from 'voca/strip_tags'
import fileSaver from 'file-saver'
const { saveAs } = fileSaver
import Panzoom from '@panzoom/panzoom'
import ClipboardJS from 'clipboard'
import lamejs from 'lamejs'
import ChargementPage from '#root/components/chargement-page.vue'
import Chargement from '#root/components/chargement.vue'
import Message from '#root/components/message.vue'
import Notification from '#root/components/notification.vue'
import Emojis from '#root/components/emojis.vue'
import { VueDraggableNext } from 'vue-draggable-next'

export default {
	name: 'Mur',
	components: {
		ChargementPage,
		Chargement,
		Message,
		Notification,
		Emojis,
		draggable: VueDraggableNext
	},
	data () {
		return {
			chargementPage: true,
			chargement: false,
			message: '',
			notification: '',
			modale: '',
			titreModale: '',
			action: '',
			mode: '',
			affichage: '',
			colonnes: [],
			affichageColonnes: [],
			colonne: 0,
			titreModaleColonne: '',
			modeColonne: '',
			titreColonne: '',
			bloc: '',
			titre: '',
			texte: '',
			media: '',
			mediaExtra: '',
			lien: '',
			iframe: '',
			vignette: '',
			vignetteDefaut: '',
			source: '',
			type: '',
			typeExtra: '',
			progressionFichier: 0,
			progressionFichierExtra: 0,
			progressionVignette: 0,
			progressionFond: 0,
			progressionEnregistrement: false,
			visibilite: true,
			visibiliteInitiale: '',
			protection: false,
			chargementLien: false,
			chargementMedia: false,
			chargementMediaExtra: false,
			menu: '',
			commentaires: [],
			commentaire: '',
			commentaireId: '',
			commentaireModifie: '',
			editeurCommentaire: '',
			editionCommentaire: false,
			emojis: '',
			evaluations: [],
			evaluation: 0,
			evaluationId: '',
			messagesChat: [],
			messageChat: '',
			nouveauxMessagesChat: 0,
			utilisateurs: [],
			utilisateur: '',
			nomUtilisateur: '',
			couleur: '#000000',
			couleurs: ['#f76707', '#f59f00', '#74b816', '#37b24d', '#0ca678', '#1098ad', '#1c7ed6', '#4263eb', '#7048e8', '#ae3ec9', '#d6336c', '#f03e3e', '#495057'],
			listeCouleurs: false,
			panneaux: [],
			fonds: ['fond1.png', 'fond2.png', 'fond3.png', 'fond4.png', 'fond5.png', 'fond6.png', 'fond7.png', 'fond8.png', 'fond9.png', 'fond10.png', 'fond11.png'],
			modaleConfirmer: false,
			messageConfirmation: '',
			typeConfirmation: '',
			donneesBloc: {},
			motDePasse: '',
			nouveauMotDePasse: '',
			defilement: false,
			depart: 0,
			distance: 0,
			resultats: {},
			page: 1,
			accesAutorise: false,
			codeAcces: '',
			codeVisible: false,
			modificationCode: false,
			codeqr: '',
			recherche: false,
			requete: '',
			chargementVignette: false,
			admins: [],
			blob: '',
			transcodage: false,
			mediaRecorder: '',
			flux: [],
			contexte: '',
			intervalle: '',
			enregistrement: false,
			dureeEnregistrement: '00 : 00',
			pressePapierLien: '',
			pressePapierIframe: '',
			typeBloc: 'classique',
			vignetteActivee: true,
			donneesUtilisateur: {},
			murDestination: '',
			colonneDestination: '',
			motDePasseAdmin: '',
			motDePasseVisible: '',
			progressionFichiers: [],
			chargementGalerie: false,
			medias: [],
			erreurImages: '',
			modaleLegende: false,
			indexGalerie: -1,
			legende: '',
			parametresImport: {
				contenu: 'ajouter',
				commentaires: false,
				evaluations: false,
				activite: false
			},
			progressionImport: 0,
			hote: this.$pageContext.pageProps.hote,
			userAgent: this.$pageContext.pageProps.userAgent,
			langues: this.$pageContext.pageProps.langues,
			identifiant: this.$pageContext.pageProps.identifiant,
			nom: this.$pageContext.pageProps.nom,
			statut: this.$pageContext.pageProps.statut,
			langue: this.$pageContext.pageProps.langue,
			acces: this.$pageContext.pageProps.acces,
			murs: this.$pageContext.pageProps.murs,
			blocsAutorises: this.$pageContext.pageProps.blocsAutorises,
			mursDigidrive: this.$pageContext.pageProps.digidrive,
			mur: this.$pageContext.pageProps.mur,
			blocs: this.$pageContext.pageProps.blocs,
			activite: this.$pageContext.pageProps.activite,
			etherpad: import.meta.env.VITE_ETHERPAD,
			etherpadApi: import.meta.env.VITE_ETHERPAD_API_KEY,
			pixabayApi: import.meta.env.VITE_PIXABAY_API_KEY,
			limite: parseFloat(import.meta.env.VITE_UPLOAD_LIMIT),
			fichiersAutorises: import.meta.env.VITE_UPLOAD_FILE_TYPES
		}
	},
	computed: {
		admin () {
			return (this.mur.hasOwnProperty('identifiant') && this.mur.identifiant === this.identifiant) || (this.mur.hasOwnProperty('admins') && this.mur.admins.includes(this.identifiant)) || (this.statut === 'auteur' && this.mur.hasOwnProperty('id') && this.murs.includes(this.mur.id))
		},
		mobile () {
			if (((this.userAgent.match(/iPhone/i) || this.userAgent.match(/iPad/i) || this.userAgent.match(/iPod/i)) && this.userAgent.match(/Mobile/i)) || this.userAgent.match(/Android/i)) {
				return true
			} else {
				return false
			}
		},
		digidrive () {
			return this.statut === 'auteur' && this.mursDigidrive.includes(this.mur.id)
		},
		blocsRecherche () {
			let resultats = []
			let blocs = []
			switch (this.requete) {
			case '!eval+':
				this.blocs.forEach(function (bloc) {
					bloc.evaluation = this.definirEvaluationCapsule(bloc.evaluations)
				}.bind(this))
				blocs = this.blocs.sort(function (a, b) {
					return b.evaluation - a.evaluation
				})
				break
			case '!eval-':
				this.blocs.forEach(function (bloc) {
					bloc.evaluation = this.definirEvaluationCapsule(bloc.evaluations)
				}.bind(this))
				blocs = this.blocs.sort(function (a, b) {
					return a.evaluation - b.evaluation
				})
				break
			case '!mod':
				blocs = this.blocs.filter(function (element) {
					return element.visibilite === 'masquee'
				})
				break
			case '!priv':
				blocs = this.blocs.filter(function (element) {
					return element.visibilite === 'privee'
				})
				break
			case '!prot':
				blocs = this.blocs.filter(function (element) {
					return element.visibilite === 'protegee'
				})
				break
			case '!comm+':
				blocs = this.blocs.sort(function (a, b) {
					return b.commentaires - a.commentaires
				})
				break
			case '!comm-':
				blocs = this.blocs.sort(function (a, b) {
					return a.commentaires - b.commentaires
				})
				break
			default:
				blocs = this.blocs.filter(function (element) {
					return element.titre.toLowerCase().includes(this.requete.toLowerCase()) || element.texte.toLowerCase().includes(this.requete.toLowerCase()) || element.media.toLowerCase().includes(this.requete.toLowerCase()) || element.iframe.toLowerCase().includes(this.requete.toLowerCase() || element.source.toLowerCase().includes(this.requete.toLowerCase()))
				}.bind(this))
			}
			if (this.mur.affichage === 'colonnes') {
				if (this.mur.colonnes && this.mur.colonnes.length > 0) {
					this.mur.colonnes.forEach(function () {
						resultats.push([])
					})
					blocs.forEach(function (bloc, index) {
						if (bloc.colonne !== undefined) {
							resultats[bloc.colonne].push(bloc)
						} else {
							blocs[index].colonne = 0
							resultats[bloc.colonne].push(bloc)
						}
					})
				} else {
					this.mur.colonnes.push(this.$t('colonneSansTitre'))
					resultats.push([])
					blocs.forEach(function (bloc, index) {
						blocs[index].colonne = 0
						resultats[0].push(bloc)
					})
				}
			} else {
				resultats = blocs
			}
			return resultats
		}
	},
	watch: {
		affichage: function (affichage) {
			if (affichage === 'colonnes') {
				this.definirColonnes(this.blocs)
				this.$nextTick(function () {
					this.activerDefilementHorizontal()
				}.bind(this))
			} else {
				this.desactiverDefilementHorizontal()
			}
		},
		blocs: {
			handler () {
				this.$nextTick(function () {
					imagesLoaded('#mur', { background: true }, function () {
						this.chargement = false
						let auteur = false
						if (this.utilisateur === this.identifiant) {
							auteur = true
						}
						const blocActif = document.querySelector('.bloc.actif')
						if (blocActif && this.action !== 'modifier' && this.bloc !== '' && auteur === true) {
							blocActif.classList.remove('actif')
						}
						if (this.action === 'ajouter' && auteur === true) {
							this.notification = this.$t('capsuleAjoutee')
							document.querySelector('#' + this.bloc).classList.add('actif')
						} else if (this.action === 'modifier' && auteur === true) {
							this.notification = this.$t('capsuleModifiee')
						} else if (this.action === 'supprimer' && auteur === true) {
							this.notification = this.$t('capsuleSupprimee')
						}
						this.utilisateur = ''
						if (this.action !== 'organiser' && auteur === true) {
							this.fermerModaleBloc()
						}
					}.bind(this))
				}.bind(this))
			},
			deep: true
		},
		messagesChat: function () {
			this.$nextTick(function () {
				document.querySelector('#messages').scrollIntoView({ behavior: 'smooth', block: 'end' })
			})
		},
		page: function (page) {
			this.rechercherImage(page)
		},
		recherche: function (valeur) {
			if (valeur === true) {
				this.$nextTick(function () {
					document.querySelector('#champ-recherche input').focus()
				})
			} else {
				this.requete = ''
			}
		}
	},
	async created () {
		const params = this.$pageContext.pageProps.params
		const identifiant = params.id
		const motdepasse = params.mdp
		if (identifiant && identifiant !== '' && motdepasse && motdepasse !== '') {
			const reponse = await axios.post(this.hote + '/api/verifier-acces', {
				mur: this.mur.id,
				identifiant: identifiant,
				motdepasse: window.atob(motdepasse)
			})
			if (reponse.data.hasOwnProperty('message') && reponse.data.message === 'mur_debloque') {
				this.identifiant = identifiant
				this.nom = reponse.data.nom
				this.langue = reponse.data.langue
				this.statut = 'auteur'
				this.mursDigidrive = reponse.data.digidrive
			}
			window.history.replaceState({}, document.title, window.location.href.split('?')[0])
		}

		const langue = params.lang
		if (langue && this.langues.includes(langue) === true) {
			this.$i18n.locale = langue
			this.langue = langue
			this.$socket.emit('modifierlangue', langue)
		} else {
			this.$i18n.locale = this.langue
		}

		if (this.mur.affichage === 'colonnes') {
			this.definirColonnes(this.blocs)
		}

		this.ecouterSocket()

		if (this.mur.acces === 'public' || (this.mur.acces === 'prive' && this.admin)) {
			this.accesAutorise = true
			this.$socket.emit('connexion', { mur: this.mur.id, identifiant: this.identifiant, nom: this.nom })
		} else if (this.mur.acces === 'code') {
			let autorisation = false
			this.acces.forEach(function (acces) {
				if (acces.hasOwnProperty('code') && acces.code === this.mur.code && acces.hasOwnProperty('mur') && acces.mur === this.mur.id) {
					autorisation = true
				}
			}.bind(this))
			const code = params.code
			if (code === this.mur.code) {
				autorisation = true
			}
			if (this.admin || autorisation === true) {
				this.accesAutorise = true
				this.$socket.emit('connexion', { mur: this.mur.id, identifiant: this.identifiant, nom: this.nom })
			}
			if (!this.accesAutorise) {
				this.modale = 'code-acces'
			}
		} else if (this.statut === 'utilisateur') {
			window.location.href = '/u/' + this.identifiant
		} else {
			window.location.replace('/')
		}

		if (this.fichiersAutorises === null || this.fichiersAutorises === undefined) {
			this.fichiersAutorises = '.jpg,.jpeg,.png,.gif,.mp4,.m4v,.mp3,.m4a,.ogg,.wav,.pdf,.ppt,.pptx,.odp,.doc,.docx,.odt,.ods,.odg,.xls,.xlsx'
		}
		if (this.limite === 0 || this.limite === null || this.limite === undefined) {
			this.limite = 10
		}

		const observer = new PerformanceObserver((liste) => {
			liste.getEntries().forEach(async function (entree) {
				if (entree.type === 'back_forward') {
					const reponse = await axios.post(this.hote + '/api/recuperer-donnees-mur', {
						id: this.mur.id,
						token: this.mur.token,
						identifiant: this.identifiant,
						statut: this.statut
					}, {
						headers: { 'Content-Type': 'application/json' }
					})
					if (reponse && reponse.hasOwnProperty('data') && reponse.data !== 'erreur_mur') {
						this.mur = reponse.data.mur
						this.blocs = reponse.data.blocs
						this.activite = reponse.data.activite
						if (this.mur.affichage === 'colonnes') {
							this.definirColonnes(this.blocs)
						}
					}
				}
			}.bind(this))
		})
		observer.observe({ type: 'navigation', buffered: true })
	},
	mounted () {
		document.getElementsByTagName('html')[0].setAttribute('lang', this.langue)

		imagesLoaded('#mur', { background: true }, function () {
			if (Object.keys(this.mur).length > 0) {
				document.documentElement.setAttribute('lang', this.langue)
				document.addEventListener('mousedown', this.surlignerBloc, false)
				window.addEventListener('beforeunload', this.quitterPage, false)
				window.addEventListener('resize', this.redimensionner, false)
				window.addEventListener('message', this.ecouterMessage, false)

				if (this.mur.affichage === 'colonnes') {
					this.activerDefilementHorizontal()
				}

				this.definirPressePapier()

				setTimeout(function () {
					this.chargementPage = false
				}.bind(this), 300)

				document.querySelector('#mur').addEventListener('dragover', function (event) {
					event.preventDefault()
					event.stopPropagation()
				}, false)

				document.querySelector('#mur').addEventListener('dragcenter', function (event) {
					event.preventDefault()
					event.stopPropagation()
				}, false)

				document.querySelector('#mur').addEventListener('drop', function (event) {
					event.preventDefault()
					event.stopPropagation()
					if (event.dataTransfer.files && event.dataTransfer.files[0] && this.accesAutorise && !this.recherche && this.mur.fichiers === 'actives' && ((this.admin && this.action !== 'organiser') || (!this.admin && this.mur.contributions !== 'fermees'))) {
						let indexColonne = 0
						if (this.mur.affichage === 'colonnes') {
							this.mur.colonnes.forEach(function (colonne, index) {
								if (document.querySelector('#colonne' + index).contains(event.target) === true) {
									indexColonne = index
								}
							})
						}
						this.ouvrirModaleBloc('creation', '', indexColonne)
						this.ajouterFichier(event.dataTransfer)
					}
				}.bind(this), false)

				window.addEventListener('paste', function (event) {
					if (event.clipboardData.files && event.clipboardData.files[0] && event.clipboardData.files[0].type.includes('image') && this.accesAutorise && !this.recherche && this.mur.fichiers === 'actives' && ((this.admin && this.action !== 'organiser') || (!this.admin && this.mur.contributions !== 'fermees')) && this.modale === '' && this.menu === '') {
						let indexColonne = 0
						if (this.mur.affichage === 'colonnes') {
							this.mur.colonnes.forEach(function (colonne, index) {
								if (document.querySelector('#colonne' + index).contains(event.target) === true) {
									indexColonne = index
								}
							})
						}
						this.ouvrirModaleBloc('creation', '', indexColonne)
						this.ajouterFichier(event.clipboardData)
					}
				}.bind(this), false)
			}
		}.bind(this))
	},
	beforeUnmount () {
		this.panneaux.forEach(function (panneau) {
			panneau.close()
		})
		this.panneaux = []
		document.removeEventListener('mousedown', this.surlignerBloc, false)
		window.removeEventListener('beforeunload', this.quitterPage, false)
		window.removeEventListener('resize', this.redimensionner, false)
		window.removeEventListener('message', this.ecouterMessage, false)
	},
	methods: {
		allerAccueil () {
			if (this.statut === 'invite' || this.statut === 'auteur') {
				this.quitterPage()
				window.location.href = '/'
			}
		},
		allerCompte () {
			this.quitterPage()
			window.location.href = '/u/' + this.identifiant
		},
		ecouterMessage (event) {
			if (this.source === 'digiview') {
				this.vignette = event.data
				this.vignetteDefaut = event.data
			}
		},
		gererRecherche () {
			if (this.action !== 'organiser') {
				this.recherche = !this.recherche
			}
		},
		definirPressePapier () {
			const lien = this.hote + '/w/' + this.mur.id + '/' + this.mur.token + '/' + this.mur.slug
			this.pressePapierLien = new ClipboardJS('#copier-lien .lien', {
				text: function () {
					return lien
				}
			})
			this.pressePapierLien.on('success', function () {
				this.notification = this.$t('lienCopie')
			}.bind(this))

			const iframe = '<iframe src="' + this.hote + '/w/' + this.mur.id + '/' + this.mur.token + '/' + this.mur.slug + '" frameborder="0" width="100%" height="500"></iframe>'
			this.pressePapierIframe = new ClipboardJS('#copier-code span', {
				text: function () {
					return iframe
				}
			})
			this.pressePapierIframe.on('success', function () {
				this.notification = this.$t('codeCopie')
			}.bind(this))
		},
		definirFond (fond) {
			if (fond.substring(0, 1) === '#') {
				return { backgroundColor: fond }
			} else {
				return { backgroundImage: 'url(' + fond + ')' }
			}
		},
		definirUtilisateurs (donnees) {
			let utilisateurs = []
			const autresUtilisateurs = []
			donnees.forEach(function (utilisateur) {
				if (utilisateur.identifiant === this.identifiant && utilisateurs.length === 0) {
					utilisateurs.push(utilisateur)
				} else if (utilisateur.identifiant !== this.identifiant) {
					autresUtilisateurs.push(utilisateur)
				}
			}.bind(this))
			utilisateurs = utilisateurs.concat(autresUtilisateurs)
			this.utilisateurs = utilisateurs
		},
		definirNom (donnees) {
			if ((!donnees.hasOwnProperty('nom') || donnees.nom === '') && donnees.identifiant.length === 13 && donnees.identifiant.substring(0, 1) === 'u') {
				return donnees.identifiant.slice(0, 8).toUpperCase()
			} else if (!donnees.hasOwnProperty('nom') || donnees.nom === '') {
				return donnees.identifiant.toUpperCase()
			} else {
				return donnees.nom
			}
		},
		definirColonnes (blocs) {
			const colonnes = []
			const affichageColonnes = []
			if (this.mur.colonnes && this.mur.colonnes.length > 0) {
				this.mur.colonnes.forEach(function () {
					colonnes.push([])
				})
				blocs.forEach(function (bloc, index) {
					if (bloc.colonne !== undefined) {
						colonnes[bloc.colonne].push(bloc)
					} else {
						blocs[index].colonne = 0
						colonnes[bloc.colonne].push(bloc)
					}
				})
				this.mur.affichageColonnes.forEach(function (affichage) {
					affichageColonnes.push(affichage)
				})
			} else {
				this.mur.colonnes.push(this.$t('colonneSansTitre'))
				colonnes.push([])
				blocs.forEach(function (bloc, index) {
					blocs[index].colonne = 0
					colonnes[0].push(bloc)
				})
				this.mur.affichageColonnes.push(true)
				affichageColonnes.push(true)
			}
			this.blocs = blocs
			this.colonnes = colonnes
			this.affichageColonnes = affichageColonnes
		},
		definirVignette (item) {
			let vignette
			let vignetteGeneree = false
			if (item.hasOwnProperty('vignetteGeneree')) {
				vignetteGeneree = item.vignetteGeneree
			}
			if (item.vignette && item.vignette !== '') {
				vignette = item.vignette
			} else if (vignetteGeneree === true) {
				vignette = this.definirLienVignette(this.mur.id, item.fichier.replace(/\.[^/.]+$/, '') + '.jpg')
			} else if (item.typeBloc === 'galerie') {
				vignette = '/img/galerie.png'
			} else {
				switch (item.type) {
				case 'audio':
				case 'enregistrement':
					vignette = '/img/audio.png'
					break
				case 'video':
					vignette = '/img/video.png'
					break
				case 'pdf':
					vignette = '/img/pdf.png'
					break
				case 'document':
					vignette = '/img/document.png'
					break
				case 'office':
					vignette = '/img/office.png'
					break
				case 'lien':
					vignette = '/img/lien.png'
					break
				case 'embed':
					if (item.source === 'peertube') {
						vignette = item.media.replace('/videos/watch/', '/static/thumbnails/') + '.jpg'
					} else if (item.source === 'h5p') {
						vignette = '/img/h5p.png'
					} else if (item.source === 'digiview') {
						vignette = '/img/digiview.png'
					} else if (item.source === 'youtube') {
						vignette = '/img/youtube.png'
					} else if (item.source === 'vimeo') {
						vignette = '/img/vimeo.png'
					} else if (item.source === 'dailymotion') {
						vignette = '/img/dailymotion.png'
					} else if (item.source === 'slideshare') {
						vignette = '/img/slideshare.png'
					} else if (item.source === 'flickr') {
						vignette = '/img/flickr.png'
					} else if (item.source === 'soundcloud') {
						vignette = '/img/soundcloud.png'
					} else if (item.source === 'twitter') {
						vignette = '/img/twitter.png'
					} else if (item.source === 'etherpad') {
						vignette = '/img/etherpad.png'
					} else if (item.media.includes('facebook.com')) {
						vignette = '/img/facebook.png'
					} else if (item.media.includes('vocaroo.com') || item.media.includes('voca.ro')) {
						vignette = '/img/vocaroo.png'
					} else if (item.media.includes('drive.google.com')) {
						vignette = '/img/google-drive.png'
					} else if (item.media.includes('docs.google.com/document')) {
						vignette = '/img/google-docs.png'
					} else if (item.media.includes('docs.google.com/presentation')) {
						vignette = '/img/google-slides.png'
					} else if (item.media.includes('docs.google.com/spreadsheets')) {
						vignette = '/img/google-sheets.png'
					} else if (item.media.includes('docs.google.com/forms')) {
						vignette = '/img/google-forms.png'
					} else if (item.media.includes('docs.google.com/drawings')) {
						vignette = '/img/google-drawings.png'
					} else if (item.media.includes('google.com/maps')) {
						vignette = '/img/google-maps.png'
					} else if (item.media.includes('wikipedia.org')) {
						vignette = '/img/wikipedia.png'
					} else if (item.media.includes('quizlet.com')) {
						vignette = '/img/quizlet.png'
					} else if (item.media.includes('genial.ly')) {
						vignette = '/img/genially.png'
					} else if (item.media.includes('ladigitale.dev')) {
						vignette = '/img/ladigitale.png'
					} else if (item.media.includes('framapad.org')) {
						vignette = '/img/framapad.png'
					} else {
						vignette = '/img/code.png'
					}
					break
				default:
					vignette = '/img/telechargement.png'
					break
				}
			}
			return vignette
		},
		definirIconeMedia (item) {
			let icone
			switch (item.type) {
			case 'image':
			case 'lien-image':
				icone = 'image'
				break
			case 'audio':
				icone = 'volume_up'
				break
			case 'video':
				icone = 'movie'
				break
			case 'pdf':
			case 'document':
			case 'office':
				icone = 'description'
				break
			case 'lien':
				icone = 'link'
				break
			case 'embed':
				if (item.source === 'youtube' || item.source === 'vimeo' || item.source === 'dailymotion' || item.source === 'digiview') {
					icone = 'movie'
				} else if (item.source === 'slideshare' || item.media.includes('wikipedia.org') || item.media.includes('drive.google.com') || item.media.includes('docs.google.com')) {
					icone = 'description'
				} else if (item.source === 'flickr') {
					icone = 'image'
				} else if (item.source === 'soundcloud' || item.media.includes('vocaroo.com') || item.media.includes('voca.ro')) {
					icone = 'volume_up'
				} else if (item.media.includes('google.com/maps')) {
					icone = 'place'
				} else if (item.source === 'etherpad' || item.media.includes('framapad.org')) {
					icone = 'group_work'
				} else {
					icone = 'web'
				}
				break
			default:
				icone = 'save_alt'
				break
			}
			if (item.typeBloc === 'galerie') {
				icone = 'collections'
			}
			return icone
		},
		definirDescription (item) {
			if (item.hasOwnProperty('modifie')) {
				return this.$t('creeeLe') + ' ' + this.$formaterDate(item.date, this.langue) + ' ' + this.$t('par') + ' ' + this.definirNom(item) + '. ' + this.$t('modifieeLe') + ' ' + this.$formaterDate(item.modifie, this.langue) + '.'
			} else {
				return this.$t('creeeLe') + ' ' + this.$formaterDate(item.date, this.langue) + ' ' + this.$t('par') + ' ' + this.definirNom(item) + '.'
			}
		},
		ouvrirModaleColonne (type, index) {
			if (type === 'edition') {
				this.colonne = index
				this.titreModaleColonne = this.$t('modifierColonne')
				this.titreColonne = this.mur.colonnes[index]
			} else {
				this.titreModaleColonne = this.$t('ajouterColonne')
			}
			this.modeColonne = type
			this.modale = 'colonne'
			this.$nextTick(function () {
				document.querySelector('#champ-nom-colonne').focus()
			})
		},
		ajouterColonne () {
			if (this.titreColonne !== '') {
				this.chargement = true
				this.$socket.emit('ajoutercolonne', this.mur.id, this.titreColonne, this.mur.colonnes, this.mur.affichageColonnes, this.identifiant, this.nom)
				this.fermerModaleColonne()
			}
		},
		modifierColonne () {
			if (this.titreColonne !== '') {
				this.chargement = true
				this.$socket.emit('modifiertitrecolonne', this.mur.id, this.titreColonne, this.colonne, this.identifiant)
				this.fermerModaleColonne()
			}
		},
		afficherColonne (colonne) {
			this.chargement = true
			this.$socket.emit('modifieraffichagecolonne', this.mur.id, true, colonne, this.identifiant)
		},
		masquerColonne (colonne) {
			this.chargement = true
			this.$socket.emit('modifieraffichagecolonne', this.mur.id, false, colonne, this.identifiant)
		},
		afficherSupprimerColonne (index) {
			this.colonne = index
			this.titreColonne = this.mur.colonnes[index]
			this.messageConfirmation = this.$t('confirmationSupprimerColonne')
			this.typeConfirmation = 'supprimer-colonne'
			this.modaleConfirmer = true
		},
		supprimerColonne () {
			this.modaleConfirmer = false
			this.chargement = true
			this.$socket.emit('supprimercolonne', this.mur.id, this.titreColonne, this.colonne, this.identifiant, this.nom)
			this.fermerModaleColonne()
		},
		fermerModaleColonne () {
			this.modale = ''
			this.titreModaleColonne = ''
			this.titreColonne = ''
			this.modeColonne = ''
			this.colonne = 0
		},
		deplacerColonne (direction, colonne) {
			this.chargement = true
			this.$socket.emit('deplacercolonne', this.mur.id, this.mur.colonnes[colonne], this.mur.affichageColonnes[colonne], direction, colonne, this.identifiant, this.nom)
		},
		definirLargeurCapsules () {
			let donnees
			switch (this.mur.largeur) {
			case 'large':
				donnees = { default: 4, 1729: 4, 1449: 3, 1365: 2, 899: 2, 499: 1 }
				break
			case 'normale':
				donnees = { default: 5, 1729: 5, 1449: 4, 1365: 3, 899: 2, 499: 1 }
				break
			}
			return donnees
		},
		ouvrirModaleBloc (mode, item, colonne) {
			this.mode = mode
			if (mode === 'creation') {
				this.titreModale = this.$t('ajouterCapsule')
			} else {
				this.$socket.emit('verifiermodifierbloc', this.mur.id, item.bloc, this.identifiant)
				this.titreModale = this.$t('modifierCapsule')
				this.donneesBloc = item
				this.bloc = item.bloc
				this.typeBloc = item.typeBloc
				this.couleur = item.couleur
				this.titre = item.titre
				this.texte = item.texte
				this.media = item.media
				this.iframe = item.iframe
				this.type = item.type
				this.source = item.source
				if (item.vignette && item.vignette !== '') {
					this.vignette = item.vignette
					this.vignetteDefaut = this.vignette
				} else if (item.type !== 'image' && (!item.vignette || item.vignette === '')) {
					this.vignette = this.definirVignette(item)
					this.vignetteDefaut = this.vignette
				}
				if (item.vignetteActivee === 'oui') {
					this.vignetteActivee = true
				} else {
					this.vignetteActivee = false
				}
				this.mediaExtra = item.mediaExtra
				this.medias = JSON.parse(JSON.stringify(item.medias))
				if (item.hasOwnProperty('protection') === true || item.visibilite === 'protegee') {
					this.protection = true
					this.visibilite = true
					this.motDePasse = item.motdepasse
				} else if (item.visibilite === 'privee') {
					this.visibilite = false
				} else {
					this.visibilite = true
				}
				if (mode === 'edition' && item.visibilite === 'privee') {
					this.visibiliteInitiale = 'privee'
				}
				if (item.iframe !== '') {
					this.lien = item.media
				}
			}
			if (this.mur.affichage === 'colonnes') {
				this.colonne = colonne
			}
			this.menu = ''
			this.modale = 'bloc'
			this.$nextTick(function () {
				if (mode === 'creation') {
					document.querySelector('#champ-titre').focus()
				}
				const that = this
				const editeur = pell.init({
					element: document.querySelector('#texte'),
					onChange: function (html) {
						let texte = html.replace(/(<a [^>]*)(target="[^"]*")([^>]*>)/gi, '$1$3')
						texte = texte.replace(/(<a [^>]*)(>)/gi, '$1 target="_blank"$2')
						texte = linkifyHtml(texte, {
							defaultProtocol: 'https',
							target: '_blank'
						})
						this.texte = texte
					}.bind(this),
					actions: [
						{ name: 'gras', title: that.$t('gras'), icon: '<i class="material-icons">format_bold</i>', result: () => pell.exec('bold') },
						{ name: 'italique', title: that.$t('italique'), icon: '<i class="material-icons">format_italic</i>', result: () => pell.exec('italic') },
						{ name: 'souligne', title: that.$t('souligne'), icon: '<i class="material-icons">format_underlined</i>', result: () => pell.exec('underline') },
						{ name: 'barre', title: that.$t('barre'), icon: '<i class="material-icons">format_strikethrough</i>', result: () => pell.exec('strikethrough') },
						{ name: 'listeordonnee', title: that.$t('listeOrdonnee'), icon: '<i class="material-icons">format_list_numbered</i>', result: () => pell.exec('insertOrderedList') },
						{ name: 'liste', title: that.$t('liste'), icon: '<i class="material-icons">format_list_bulleted</i>', result: () => pell.exec('insertUnorderedList') },
						{ name: 'couleur', title: that.$t('couleurTexte'), icon: '<label for="couleur-texte"><i class="material-icons">format_color_text</i></label><input id="couleur-texte" type="color">', result: () => undefined },
						{ name: 'lien', title: that.$t('lien'), icon: '<i class="material-icons">link</i>', result: () => { const url = window.prompt(that.$t('adresseLien')); if (url) { pell.exec('createLink', url) } } }
					],
					classes: { actionbar: 'boutons-editeur', button: 'bouton-editeur', content: 'contenu-editeur', selected: 'bouton-actif' }
				})
				editeur.content.innerHTML = this.texte
				editeur.onpaste = function (event) {
					event.preventDefault()
					event.stopPropagation()
					let html = event.clipboardData.getData('text/html')
					if (html !== '') {
						html = stripTags(html, ['b', 'i', 'u', 'a', 'br', 'div', 'font', 'ul', 'ol'])
						html = html.replace(/style=".*?"/mg, '')
						html = html.replace(/class=".*?"/mg, '')
						pell.exec('insertHTML', html)
					} else {
						pell.exec('insertText', event.clipboardData.getData('text/plain'))
					}
				}
				document.querySelector('#texte .contenu-editeur').addEventListener('focus', function () {
					document.querySelector('#texte').classList.add('focus')
				})
				document.querySelector('#texte .contenu-editeur').addEventListener('blur', function () {
					document.querySelector('#texte').classList.remove('focus')
				})
				document.querySelector('#couleur-texte').addEventListener('change', this.modifierCouleurTexte)
			}.bind(this))
		},
		modifierCouleurTexte (event) {
			pell.exec('foreColor', event.target.value)
		},
		modifierCouleurCommentaire (event) {
			pell.exec('foreColor', event.target.value)
		},
		modifierCouleurCommentaireModifie (event) {
			pell.exec('foreColor', event.target.value)
		},
		ajouterFichier (champ) {
			const fichiersAutorises = this.fichiersAutorises.split(',').map((e) => { return e.trim().substring(1) })
			const extension = champ.files[0].name.substring(champ.files[0].name.lastIndexOf('.') + 1).toLowerCase()
			if (champ.files && champ.files[0] && fichiersAutorises.includes(extension) && champ.files[0].size < this.limite * 1024000) {
				const fichier = champ.files[0]
				const formulaire = new FormData()
				formulaire.append('fichier', fichier)
				axios.post(this.hote + '/api/televerser-fichier', formulaire, {
					headers: {
						'Content-Type': 'multipart/form-data'
					},
					onUploadProgress: function (progression) {
						const pourcentage = parseInt(Math.round((progression.loaded * 100) / progression.total))
						this.progressionFichier = pourcentage
					}.bind(this)
				}).then(function (reponse) {
					const donnees = reponse.data
					if (donnees === 'non_connecte') {
						window.location.replace('/')
					} else if (donnees === 'erreur_televersement') {
						champ.value = ''
						this.progressionFichier = 0
						this.message = this.$t('erreurTeleversementFichier')
					} else {
						this.chargementMedia = true
						this.media = donnees.fichier
						this.type = donnees.mimetype.split('/')[0]
						donnees.type = this.type
						const vignette = this.definirVignette(donnees)
						if (this.type !== 'image') {
							this.vignette = vignette
							this.vignetteDefaut = vignette
						}
						switch (this.type) {
						case 'image':
							this.$nextTick(function () {
								imagesLoaded('#media', function () {
									this.chargementMedia = false
								}.bind(this))
							}.bind(this))
							break
						case 'video':
							this.$nextTick(function () {
								const video = document.querySelector('#video')
								video.addEventListener('loadedmetadata', function () {
									imagesLoaded('#vignette', function () {
										this.chargementMedia = false
									}.bind(this))
								}.bind(this))
							}.bind(this))
							break
						case 'audio':
							this.$nextTick(function () {
								const audio = document.querySelector('#audio')
								audio.addEventListener('loadedmetadata', function () {
									imagesLoaded('#vignette', function () {
										this.chargementMedia = false
									}.bind(this))
								}.bind(this))
							}.bind(this))
							break
						case 'pdf':
						case 'document':
						case 'office':
							this.$nextTick(function () {
								const iframe = document.querySelector('#document')
								iframe.addEventListener('load', function () {
									imagesLoaded('#vignette', function () {
										this.chargementMedia = false
									}.bind(this))
								}.bind(this))
							}.bind(this))
							break
						default:
							this.chargementMedia = false
						}
					}
					this.progressionFichier = 0
					champ.value = ''
				}.bind(this)).catch(function () {
					champ.value = ''
					this.progressionFichier = 0
					this.message = this.$t('erreurCommunicationServeur')
				}.bind(this))
			} else {
				if (fichiersAutorises.includes(extension) === false) {
					this.message = this.$t('formatFichierPasAccepte')
				} else if (champ.files[0].size > this.limite * 1024000) {
					this.message = this.$t('tailleMaximale', { taille: this.limite })
				}
				champ.value = ''
			}
		},
		ajouterImage (champ) {
			const fichiersAutorises = ['jpg', 'jpeg', 'png', 'gif']
			const extension = champ.files[0].name.substring(champ.files[0].name.lastIndexOf('.') + 1).toLowerCase()
			if (champ.files && champ.files[0] && fichiersAutorises.includes(extension) && champ.files[0].size < this.limite * 1024000) {
				const fichier = champ.files[0]
				const formulaire = new FormData()
				formulaire.append('fichier', fichier)
				axios.post(this.hote + '/api/televerser-fichier', formulaire, {
					headers: {
						'Content-Type': 'multipart/form-data'
					},
					onUploadProgress: function (progression) {
						const pourcentage = parseInt(Math.round((progression.loaded * 100) / progression.total))
						this.progressionFichier = pourcentage
					}.bind(this)
				}).then(function (reponse) {
					const donnees = reponse.data
					if (donnees === 'non_connecte') {
						window.location.replace('/')
					} else if (donnees === 'erreur_televersement') {
						champ.value = ''
						this.progressionFichier = 0
						this.message = this.$t('erreurTeleversementFichier')
					} else {
						this.chargementMedia = true
						this.media = donnees.fichier
						this.type = donnees.mimetype.split('/')[0]
						this.$nextTick(function () {
							imagesLoaded('#media', function () {
								this.chargementMedia = false
							}.bind(this))
						}.bind(this))
					}
					this.progressionFichier = 0
					champ.value = ''
				}.bind(this)).catch(function () {
					champ.value = ''
					this.progressionFichier = 0
					this.message = this.$t('erreurCommunicationServeur')
				}.bind(this))
			} else if (fichiersAutorises.includes(extension) === false) {
				this.message = this.$t('formatFichierPasAccepte')
			} else if (champ.files[0].size > this.limite * 1024000) {
				this.message = this.$t('tailleMaximale', { taille: this.limite })
			}
			champ.value = ''
		},
		ajouterImages (champ) {
			const fichiersAutorises = ['jpg', 'jpeg', 'png', 'gif']
			let images = []
			let erreursFormat = 0
			let erreursTaille = 0
			for (let i = 0; i < champ.files.length; i++) {
				const fichier = champ.files[i]
				const extension = fichier.name.substring(fichier.name.lastIndexOf('.') + 1).toLowerCase()
				if (fichiersAutorises.includes(extension) && fichier.size < (this.limite / 10) * 1024000) {
					images.push(fichier)
				} else if (fichiersAutorises.includes(extension) === false) {
					erreursFormat++
				} else if (fichier.size > (this.limite / 10) * 1024000) {
					erreursTaille++
				}
			}
			if (erreursFormat > 0 && erreursTaille === 0) {
				this.erreurImages = this.$t('formatImagesAutorisees')
			} else if (erreursFormat === 0 && erreursTaille > 0) {
				this.erreurImages = this.$t('tailleMaximale', { taille: this.limite / 10 })
			} else if (erreursFormat > 0 && erreursTaille > 0) {
				this.erreurImages = this.$t('formatImagesAutoriseesTailleMaximale', { taille: this.limite / 10 })
			}
			if (images.length > 0 && this.medias.length < 11) {
				this.chargementGalerie = true
				const imagesTeleversees = []
				for (let i = 0; i < images.length; i++) {
					this.progressionFichiers.push(0)
				}
				for (const [index, fichier] of images.entries()) {
					const imageTeleversee = new Promise(function (resolve) {
						const formulaire = new FormData()
						formulaire.append('fichier', fichier)
						axios.post(this.hote + '/api/televerser-fichier', formulaire, {
							headers: {
								'Content-Type': 'multipart/form-data'
							},
							onUploadProgress: function (progression) {
								const pourcentage = parseInt(Math.round((progression.loaded * 100) / progression.total))
								this.progressionFichiers[index] = pourcentage
							}.bind(this)
						}).then(function (reponse) {
							const donnees = reponse.data
							if (donnees === 'erreur_televersement') {
								resolve('erreur')
							} else {
								this.medias.push({ fichier: donnees.fichier, legende: '' })
								resolve(donnees.fichier)
							}
							this.progressionFichiers[index] = 0
						}.bind(this)).catch(function () {
							this.progressionFichiers[index] = 0
							resolve('erreur')
						})
					}.bind(this))
					imagesTeleversees.push(imageTeleversee)
				}
				Promise.all(imagesTeleversees).then(function () {
					this.erreurImages = ''
					images = []
					this.progressionFichiers = []
					this.chargementGalerie = false
					this.vignette = this.definirVignette({ typeBloc: 'galerie' })
					this.vignetteDefaut = this.definirVignette({ typeBloc: 'galerie' })
				}.bind(this))
			} else if (this.medias.length > 10) {
				this.message = this.$t('nombreMaximumImages')
			}
			champ.value = ''
		},
		afficherModifierLegende (index) {
			this.indexGalerie = index
			if (this.medias[index].legende !== '') {
				this.legende = this.medias[index].legende
			}
			this.modaleLegende = true
			if (this.legende === '') {
				this.$nextTick(function () {
					document.querySelector('#legende textarea').focus()
				})
			}
		},
		modifierLegende () {
			if (this.indexGalerie !== -1 && this.legende !== '') {
				this.medias[this.indexGalerie].legende = this.legende
				this.fermerModaleLegende()
			}
		},
		fermerModaleLegende () {
			this.modaleLegende = false
			this.indexGalerie = -1
			this.legende = ''
		},
		supprimerImageGalerie (index) {
			this.medias.splice(index, 1)
			this.progressionFichiers.splice(index, 1)
		},
		ajouterFichierAudio (champ) {
			const fichiersAutorises = ['mp3', 'm4a', 'ogg', 'wav']
			const extension = champ.files[0].name.substring(champ.files[0].name.lastIndexOf('.') + 1).toLowerCase()
			if (champ.files && champ.files[0] && fichiersAutorises.includes(extension) && champ.files[0].size < this.limite * 1024000) {
				const fichier = champ.files[0]
				const formulaire = new FormData()
				formulaire.append('fichier', fichier)
				axios.post(this.hote + '/api/televerser-fichier', formulaire, {
					headers: {
						'Content-Type': 'multipart/form-data'
					},
					onUploadProgress: function (progression) {
						const pourcentage = parseInt(Math.round((progression.loaded * 100) / progression.total))
						this.progressionFichierExtra = pourcentage
					}.bind(this)
				}).then(function (reponse) {
					const donnees = reponse.data
					if (donnees === 'non_connecte') {
						window.location.replace('/')
					} else if (donnees === 'erreur_televersement') {
						champ.value = ''
						this.progressionFichierExtra = 0
						this.message = this.$t('erreurTeleversementFichier')
					} else {
						this.chargementMediaExtra = true
						this.mediaExtra = donnees.fichier
						this.typeExtra = donnees.mimetype.split('/')[0]
						this.$nextTick(function () {
							const audio = document.querySelector('#audio')
							audio.addEventListener('loadedmetadata', function () {
								this.chargementMediaExtra = false
							}.bind(this))
						}.bind(this))
					}
					this.progressionFichierExtra = 0
					champ.value = ''
				}.bind(this)).catch(function () {
					champ.value = ''
					this.progressionFichierExtra = 0
					this.message = this.$t('erreurCommunicationServeur')
				}.bind(this))
			} else if (fichiersAutorises.includes(extension) === false) {
				this.message = this.$t('formatFichierPasAccepte')
			} else if (champ.files[0].size > this.limite * 1024000) {
				this.message = this.$t('tailleMaximale', { taille: this.limite })
			}
			champ.value = ''
		},
		definirExtensionFichier (fichier) {
			return fichier.substring(fichier.lastIndexOf('.') + 1)
		},
		definirNomFichier (fichier) {
			return fichier.substring(0, fichier.lastIndexOf('.'))
		},
		supprimerFichier () {
			if (this.verifierURL(this.media) === true && this.media.includes(this.etherpad)) {
				const etherpadId = this.media.replace(this.etherpad + '/p/', '')
				const url = this.etherpad + '/api/1/deletePad?apikey=' + this.etherpadApi + '&padID=' + etherpadId
				axios.get(url)
			}
			this.media = ''
			this.lien = ''
			this.type = ''
			this.vignette = ''
			this.vignetteDefaut = ''
			this.resultats = {}
		},
		supprimerImage () {
			this.media = ''
			this.type = ''
		},
		supprimerFichierAudio () {
			this.mediaExtra = ''
			this.typeExtra = ''
		},
		async ajouterAudio () {
			this.transcodage = true
			const blob = await this.blobEnMp3()
			const formulaire = new FormData()
			formulaire.append('mur', this.mur.id)
			formulaire.append('fichier', blob, 'enregistrement.mp3')
			axios.post(this.hote + '/api/televerser-audio', formulaire, {
				headers: {
					'Content-Type': 'multipart/form-data'
				},
				onUploadProgress: function () {
					this.progressionEnregistrement = true
				}.bind(this)
			}).then(function (reponse) {
				const donnees = reponse.data
				if (donnees === 'non_connecte') {
					window.location.replace('/')
				} else if (donnees === 'erreur_televersement') {
					this.progressionEnregistrement = false
					this.message = this.$t('erreurTeleversementFichier')
				} else {
					this.modale = ''
					if (this.mode === 'creation' && this.typeBloc === 'classique') {
						this.$socket.emit('ajouterbloc', this.bloc, this.typeBloc, this.mur.id, this.mur.token, this.titre, this.texte, donnees, this.iframe, 'audio', this.source, this.vignette, this.vignetteActivee, this.mediaExtra, this.medias, this.couleur, this.colonne, this.visibilite, this.protection, this.motDePasse, this.identifiant, this.nom, this.admin)
					} else if (this.mode === 'edition' && this.typeBloc === 'classique') {
						this.$socket.emit('modifierbloc', this.bloc, this.typeBloc, this.mur.id, this.mur.token, this.titre, this.texte, donnees, this.iframe, 'audio', this.source, this.vignette, this.vignetteActivee, this.mediaExtra, this.medias, this.couleur, this.colonne, this.visibilite, this.protection, this.motDePasse, this.identifiant, this.nom, this.admin)
					} else if (this.mode === 'creation' && this.typeBloc === 'image-audio') {
						this.$socket.emit('ajouterbloc', this.bloc, this.typeBloc, this.mur.id, this.mur.token, this.titre, this.texte, this.media, this.iframe, this.type, this.source, this.vignette, this.vignetteActivee, donnees, this.medias, this.couleur, this.colonne, this.visibilite, this.protection, this.motDePasse, this.identifiant, this.nom, this.admin)
					} else if (this.mode === 'edition' && this.typeBloc === 'image-audio') {
						this.$socket.emit('modifierbloc', this.bloc, this.typeBloc, this.mur.id, this.mur.token, this.titre, this.texte, this.media, this.iframe, this.type, this.source, this.vignette, this.vignetteActivee, donnees, this.medias, this.couleur, this.colonne, this.visibilite, this.protection, this.motDePasse, this.identifiant, this.nom, this.admin)
					}
				}
				this.progressionEnregistrement = false
			}.bind(this)).catch(function () {
				this.progressionEnregistrement = false
				this.message = this.$t('erreurCommunicationServeur')
			}.bind(this))
		},
		blobEnMp3 () {
			return new Promise(function (resolve) {
				const audioContext = new AudioContext()
				const fileReader = new FileReader()
				fileReader.onloadend = function () {
					const arrayBuffer = fileReader.result
					audioContext.decodeAudioData(arrayBuffer, function (audioBuffer) {
						resolve(this.transcoder(audioBuffer))
					}.bind(this))
				}.bind(this)
				fileReader.readAsArrayBuffer(this.blob)
			}.bind(this))
		},
		enregistrerAudio () {
			if (!navigator.mediaDevices || !navigator.mediaDevices?.enumerateDevices) {
				this.notification = this.$t('enregistrementNonSupporte')
			} else {
				navigator.mediaDevices.enumerateDevices().then(function (devices) {
					let entreeAudio = false
					for (const device of devices) {
						if (device.kind === 'audioinput') {
							entreeAudio = true
							break
						}
					}
					if (entreeAudio === true) {
						if (!navigator.mediaDevices?.getUserMedia) {
							this.notification = this.$t('enregistrementNonSupporte')
						} else {
							navigator.mediaDevices.getUserMedia({ audio: true }).then(function (flux) {
								this.mediaRecorder = new MediaRecorder(flux)
								this.mediaRecorder.start()
								this.$nextTick(function () {
									this.visualiser(flux)
								}.bind(this))
								this.enregistrement = true
								const temps = Date.now()
								this.intervalle = setInterval(function () {
									const delta = Date.now() - temps
									let secondes = Math.floor((delta / 1000) % 60)
									let minutes = Math.floor((delta / 1000 / 60) << 0)
									if (secondes < 10) {
										secondes = '0' + secondes
									}
									if (minutes < 10) {
										minutes = '0' + minutes
									}
									this.dureeEnregistrement = minutes + ' : ' + secondes
									if (this.dureeEnregistrement === '02 : 00') {
										this.arreterEnregistrementAudio()
									}
								}.bind(this), 100)
								this.mediaRecorder.onstop = function () {
									if (this.flux.length > 0) {
										this.blob = new Blob(this.flux, { type: 'audio/wav' })
										this.enregistrement = false
										if (this.typeBloc === 'image-audio') {
											this.mediaExtra = URL.createObjectURL(this.blob)
											this.typeExtra = 'enregistrement'
										} else {
											this.media = URL.createObjectURL(this.blob)
											this.type = 'enregistrement'
											const donnees = {}
											donnees.type = this.type
											const vignette = this.definirVignette(donnees)
											this.vignette = vignette
											this.vignetteDefaut = vignette
										}
										this.mediaRecorder = ''
										this.flux = []
										this.contexte = ''
										this.dureeEnregistrement = '00 : 00'
										if (this.intervalle !== '') {
											clearInterval(this.intervalle)
											this.intervalle = ''
										}
									}
								}.bind(this)
								this.mediaRecorder.ondataavailable = function (e) {
									this.flux.push(e.data)
								}.bind(this)
							}.bind(this)).catch(function () {
								this.enregistrement = false
								this.mediaRecorder = ''
								this.flux = []
								this.contexte = ''
								this.notification = this.$t('erreurMicro')
							}.bind(this))
						}
					} else {
						this.notification = this.$t('aucuneEntreeAudio')
					}
				}.bind(this))
			}
		},
		arreterEnregistrementAudio () {
			this.mediaRecorder.stop()
		},
		visualiser (flux) {
			if (!this.contexte) {
				this.contexte = new AudioContext()
			}
			const source = this.contexte.createMediaStreamSource(flux)
			const analyser = this.contexte.createAnalyser()
			analyser.fftSize = 2048
			const bufferLength = analyser.frequencyBinCount
			const dataArray = new Uint8Array(bufferLength)
			source.connect(analyser)

			this.$nextTick(function () {
				draw()
			})

			function draw () {
				if (document.querySelector('#visualisation')) {
					const canvas = document.querySelector('#visualisation')
					const canvasCtx = canvas.getContext('2d')
					const largeur = document.querySelector('#enregistrement').offsetWidth
					const hauteur = canvas.height
					canvas.width = largeur
					requestAnimationFrame(draw)
					analyser.getByteTimeDomainData(dataArray)

					canvasCtx.fillStyle = '#eeeeee'
					canvasCtx.fillRect(0, 0, largeur, hauteur)
					canvasCtx.lineWidth = 2
					canvasCtx.strokeStyle = '#000000'
					canvasCtx.beginPath()

					const sliceWidth = largeur * 1.0 / bufferLength
					let x = 0

					for (let i = 0; i < bufferLength; i++) {
						const v = dataArray[i] / 128.0
						const y = v * hauteur / 2
						if (i === 0) {
							canvasCtx.moveTo(x, y)
						} else {
							canvasCtx.lineTo(x, y)
						}
						x += sliceWidth
					}
					canvasCtx.lineTo(canvas.width, canvas.height / 2)
					canvasCtx.stroke()
				}
			}
		},
		ajouterLien () {
			if (this.lien !== '') {
				const regex = /<iframe(.+)<\/iframe>/g
				if (regex.test(this.lien) === true) {
					this.lien = this.lien.match(/<iframe [^>]*src="[^"]*"[^>]*>/g).map(x => x.replace(/.*src="([^"]*)".*/, '$1'))[0]
				}
				if (this.verifierURL(this.lien) === true && this.lien.match(/\.(jpeg|jpg|gif|png)$/) === null) {
					this.chargementLien = true
					axios.get('https://noembed.com/embed?url=' + this.lien).then(function (reponse) {
						let donnees = reponse.data
						if (donnees.hasOwnProperty('error')) {
							this.iframe = this.lien
							this.$nextTick(function () {
								this.media = this.lien
								this.source = 'web'
								if (this.lien.includes('tube.ac-lyon.fr')) {
									this.source = 'peertube'
								} else if (this.lien.includes('ladigitale.dev/digiquiz/')) {
									this.source = 'h5p'
								} else if (this.lien.includes('ladigitale.dev/digiview/')) {
									this.source = 'digiview'
								}
								this.type = 'embed'
								donnees = {}
								donnees.media = this.media
								donnees.source = this.source
								donnees.type = this.type
								if (this.source === 'web' && !this.media.includes('facebook.com') && !this.media.includes('vocaroo.com') && !this.media.includes('drive.google.com') && !this.media.includes('docs.google.com') && !this.media.includes('google.com/maps') && !this.media.includes('wikipedia.org') && !this.media.includes('genial.ly') && !this.media.includes('ladigitale.dev/digitools/') && !this.media.includes('framapad.org')) {
									this.chargementLien = false
									this.chargementVignette = true
									const url = new URL(this.lien)
									const domaine = url.hostname
									const protocole = url.protocol
									axios.post(this.hote + '/api/recuperer-icone', {
										domaine: domaine,
										protocole: protocole
									}).then(async function (reponse) {
										this.chargementVignette = false
										if (reponse.data === 'erreur') {
											this.vignette = this.definirVignette(donnees)
											this.vignetteDefaut = this.definirVignette(donnees)
										} else if (reponse.data === '') {
											const favicon = await this.verifierIcone(protocole + '//' + domaine + '/favicon.ico')
											if (favicon === true) {
												this.vignette = protocole + '//' + domaine + '/favicon.ico'
												this.vignetteDefaut = protocole + '//' + domaine + '/favicon.ico'
											} else {
												this.vignette = this.definirVignette(donnees)
												this.vignetteDefaut = this.definirVignette(donnees)
											}
										} else {
											const favicon = await this.verifierIcone(reponse.data)
											if (favicon === true) {
												this.vignette = reponse.data
												this.vignetteDefaut = reponse.data
											} else {
												this.vignette = this.definirVignette(donnees)
												this.vignetteDefaut = this.definirVignette(donnees)
											}
										}
									}.bind(this)).catch(function () {
										this.vignette = this.definirVignette(donnees)
										this.vignetteDefaut = this.definirVignette(donnees)
										this.chargementVignette = false
									}.bind(this))
								} else {
									this.vignette = this.definirVignette(donnees)
									this.vignetteDefaut = this.definirVignette(donnees)
									this.chargementLien = false
								}
							}.bind(this))
						} else {
							if (donnees.provider_name.toLowerCase() === 'learningapps.org') {
								donnees.html = donnees.html.replace('http://LearningApps.org', 'https://learningapps.org')
							}
							if (regex.test(donnees.html) === true) {
								this.iframe = donnees.html.match(/<iframe [^>]*src="[^"]*"[^>]*>/g).map(x => x.replace(/.*src="([^"]*)".*/, '$1'))[0]
							} else {
								this.iframe = donnees.html
							}
							this.media = this.lien
							this.source = donnees.provider_name.toLowerCase()
							this.type = 'embed'
							if (donnees.thumbnail_url && donnees.thumbnail_url !== '') {
								this.vignette = donnees.thumbnail_url
								this.vignetteDefaut = donnees.thumbnail_url
							} else {
								donnees.media = this.media
								donnees.source = this.source
								donnees.type = this.type
								this.vignette = this.definirVignette(donnees)
								this.vignetteDefaut = this.definirVignette(donnees)
							}
							this.chargementLien = false
						}
					}.bind(this)).catch(function () {
						this.chargementLien = false
						this.lien = ''
						this.message = this.$t('erreurRecuperationContenu')
					}.bind(this))
				} else if (this.verifierURL(this.lien) === true && this.lien.match(/\.(jpeg|jpg|gif|png)$/) !== null) {
					this.chargementMedia = true
					this.media = this.lien
					this.type = 'lien-image'
					this.$nextTick(function () {
						imagesLoaded('#media', function () {
							this.chargementMedia = false
						}.bind(this))
					}.bind(this))
				} else {
					this.rechercherImage(1)
				}
			}
		},
		verifierIcone (lien) {
			return new Promise(function (resolve) {
				const img = new Image()
				img.src = lien
				img.onload = () => resolve(true)
				img.onerror = () => resolve(false)
			})
		},
		rechercherImage (page) {
			if (this.lien !== '') {
				this.chargementLien = true
				const requete = this.lien.replace(/\s+/g, '+')
				if (page === 1) {
					this.page = page
				}
				axios.get('https://pixabay.com/api/?key=' + this.pixabayApi + '&q=' + requete + '&image_type=photo&lang=' + this.langue + '&orientation=horizontal&safesearch=true&per_page=16&page=' + page).then(function (reponse) {
					this.chargementLien = false
					const donnees = reponse.data
					if (donnees && donnees.total > 0) {
						this.resultats = donnees
						this.$nextTick(function () {
							// eslint-disable-next-line
							new flexImages({ selector: '#resultats', rowHeight: 60 })
						})
					}
				}.bind(this)).catch(function () {
					this.chargementLien = false
					this.lien = ''
					this.message = this.$t('erreurRecuperationContenu')
				}.bind(this))
			}
		},
		modifierPage (type) {
			if (type === 'suivante' && this.page < (this.resultats.total / 16)) {
				this.page++
			} else if (type === 'precedente' && this.page > 1) {
				this.page--
			}
		},
		selectionnerImage (image) {
			this.chargementMedia = true
			this.media = image
			this.type = 'lien-image'
			this.$nextTick(function () {
				imagesLoaded('#media', function () {
					this.chargementMedia = false
				}.bind(this))
			}.bind(this))
		},
		verifierURL (lien) {
			let url
			try {
				url = new URL(lien)
			} catch (_) {
				return false
			}
			return url.protocol === 'http:' || url.protocol === 'https:'
		},
		convertirEnLien () {
			this.iframe = ''
			this.media = this.lien
			this.source = 'web'
			this.type = 'lien'
			if (this.vignette === '' || this.vignette === '/img/code.png') {
				this.vignette = '/img/lien.png'
			}
		},
		supprimerLien () {
			if (this.iframe.includes(this.etherpad)) {
				const etherpadId = this.iframe.replace(this.etherpad + '/p/', '')
				const url = this.etherpad + '/api/1/deletePad?apikey=' + this.etherpadApi + '&padID=' + etherpadId
				axios.get(url)
			}
			this.media = ''
			this.lien = ''
			this.iframe = ''
			this.type = ''
			this.source = ''
			this.vignette = ''
			this.vignetteDefaut = ''
			this.resultats = {}
			this.chargementVignette = false
		},
		ajouterDocument () {
			this.chargementLien = true
			this.lien = this.etherpad + '/p/mur-' + this.mur.id + '-' + Math.random().toString(16).slice(2)
			this.iframe = this.lien
			this.$nextTick(function () {
				this.media = this.lien
				this.source = 'etherpad'
				this.type = 'embed'
				const donnees = {}
				donnees.media = this.media
				donnees.source = this.source
				donnees.type = this.type
				this.vignette = this.definirVignette(donnees)
				this.vignetteDefaut = this.definirVignette(donnees)
				this.chargementLien = false
			}.bind(this))
		},
		ajouterVignette () {
			const champ = document.querySelector('#televerser-vignette')
			const formats = ['jpg', 'jpeg', 'png', 'gif']
			const extension = champ.files[0].name.substring(champ.files[0].name.lastIndexOf('.') + 1).toLowerCase()
			if (champ.files && champ.files[0] && formats.includes(extension) && champ.files[0].size < 3072000) {
				const fichier = champ.files[0]
				const formulaire = new FormData()
				formulaire.append('fichier', fichier)
				axios.post(this.hote + '/api/televerser-vignette', formulaire, {
					headers: {
						'Content-Type': 'multipart/form-data'
					},
					onUploadProgress: function (progression) {
						const pourcentage = parseInt(Math.round((progression.loaded * 100) / progression.total))
						this.progressionVignette = pourcentage
					}.bind(this)
				}).then(function (reponse) {
					const donnees = reponse.data
					if (donnees === 'non_connecte') {
						window.location.replace('/')
					} else if (donnees === 'erreur_televersement') {
						champ.value = ''
						this.progressionVignette = 0
						this.message = this.$t('erreurTeleversementVignette')
					} else {
						this.vignette = donnees
						this.$nextTick(function () {
							imagesLoaded('#vignette', function () {
								this.progressionVignette = 0
								this.$nextTick(function () {
									const modaleBloc = document.querySelector('#bloc')
									modaleBloc.scrollTop = modaleBloc.scrollHeight
								})
							}.bind(this))
						}.bind(this))
					}
					champ.value = ''
				}.bind(this)).catch(function () {
					champ.value = ''
					this.progressionVignette = 0
					this.message = this.$t('erreurCommunicationServeur')
				}.bind(this))
			} else {
				if (formats.includes(extension) === false) {
					this.message = this.$t('formatFichierPasAccepte')
				} else if (champ.files[0].size > 3072000) {
					this.message = this.$t('tailleMaximale', { taille: 3 })
				}
				champ.value = ''
			}
		},
		remettreVignetteDefaut () {
			this.vignette = this.vignetteDefaut
		},
		modifierVisibiliteCapsule () {
			this.visibilite = !this.visibilite
		},
		modifierProtectionCapsule () {
			this.protection = !this.protection
			if (this.protection === true && this.motDePasse === '') {
				this.motDePasse = Math.floor(1000 + Math.random() * 9000)
				this.$nextTick(function () {
					document.querySelector('#champ-motdepasse').focus()
				})
			}
		},
		modifierTypeBloc (event) {
			if (event.target.value === 'image-audio') {
				this.typeBloc = event.target.value
				if (this.media !== '' && this.type !== 'image') {
					this.media = ''
					this.type = ''
				}
				this.source = ''
				this.lien = ''
				this.iframe = ''
				this.medias = []
				this.vignette = ''
				this.vignetteDefaut = ''
				this.vignetteActivee = false
			} else if (event.target.value === 'galerie') {
				this.typeBloc = event.target.value
				this.media = ''
				this.type = ''
				this.source = ''
				this.lien = ''
				this.iframe = ''
				this.mediaExtra = ''
				this.typeExtra = ''
				this.vignetteActivee = true
			} else {
				this.typeBloc = 'classique'
				this.mediaExtra = ''
				this.typeExtra = ''
				this.medias = []
			}
		},
		modifierVignetteActivee () {
			this.vignetteActivee = !this.vignetteActivee
		},
		ajouterBloc () {
			this.bloc = 'bloc-id-' + (new Date()).getTime() + Math.random().toString(16).slice(10)
			if (((this.typeBloc === 'classique' && (this.titre !== '' || this.texte !== '' || this.media !== '') && ((this.protection === true && this.motDePasse !== '') || this.protection === false)) || (this.typeBloc === 'galerie' && this.medias.length > 1 && ((this.protection === true && this.motDePasse !== '') || this.protection === false)) || (this.typeBloc === 'image-audio' && this.media !== '' && this.mediaExtra !== '' && ((this.protection === true && this.motDePasse !== '') || this.protection === false))) && this.type !== 'enregistrement' && this.typeExtra !== 'enregistrement') {
				this.chargement = true
				this.$socket.emit('ajouterbloc', this.bloc, this.typeBloc, this.mur.id, this.mur.token, this.titre, this.texte, this.media, this.iframe, this.type, this.source, this.vignette, this.vignetteActivee, this.mediaExtra, this.medias, this.couleur, this.colonne, this.visibilite, this.protection, this.motDePasse, this.identifiant, this.nom, this.admin)
				this.modale = ''
			} else if (((this.typeBloc === 'classique' && (this.titre !== '' || this.texte !== '' || this.media !== '') && ((this.protection === true && this.motDePasse !== '') || this.protection === false)) || (this.typeBloc === 'image-audio' && this.media !== '' && this.mediaExtra !== '' && ((this.protection === true && this.motDePasse !== '') || this.protection === false))) && (this.type === 'enregistrement' || this.typeExtra === 'enregistrement')) {
				this.ajouterAudio()
			}
		},
		modifierBloc () {
			if (((this.typeBloc === 'classique' && (this.titre !== '' || this.texte !== '' || this.media !== '') && ((this.protection === true && this.motDePasse !== '') || this.protection === false)) || (this.typeBloc === 'galerie' && this.medias.length > 1 && ((this.protection === true && this.motDePasse !== '') || this.protection === false)) || (this.typeBloc === 'image-audio' && this.media !== '' && this.mediaExtra !== '' && ((this.protection === true && this.motDePasse !== '') || this.protection === false))) && this.type !== 'enregistrement' && this.typeExtra !== 'enregistrement') {
				this.chargement = true
				this.$socket.emit('modifierbloc', this.bloc, this.typeBloc, this.mur.id, this.mur.token, this.titre, this.texte, this.media, this.iframe, this.type, this.source, this.vignette, this.vignetteActivee, this.mediaExtra, this.medias, this.couleur, this.colonne, this.visibilite, this.protection, this.motDePasse, this.identifiant, this.nom, this.admin)
				this.modale = ''
			} else if (((this.typeBloc === 'classique' && (this.titre !== '' || this.texte !== '' || this.media !== '') && ((this.protection === true && this.motDePasse !== '') || this.protection === false)) || (this.typeBloc === 'image-audio' && this.media !== '' && this.mediaExtra !== '' && ((this.protection === true && this.motDePasse !== '') || this.protection === false))) && (this.type === 'enregistrement' || this.typeExtra === 'enregistrement')) {
				this.ajouterAudio()
			}
		},
		autoriserBloc (donneesBloc, moderation) {
			this.chargement = true
			let indexBloc, indexBlocColonne
			this.blocs.forEach(function (item, index) {
				if (item.bloc === donneesBloc.bloc) {
					indexBloc = index
				}
			})
			if (this.mur.affichage === 'colonnes') {
				this.colonnes.forEach(function (colonne) {
					colonne.forEach(function (item, index) {
						if (item.bloc === donneesBloc.bloc) {
							indexBlocColonne = index
						}
					})
				})
			}
			this.$socket.emit('autoriserbloc', this.mur.id, this.mur.token, donneesBloc, indexBloc, indexBlocColonne, moderation, this.identifiant)
		},
		fermerModaleBloc () {
			this.modale = ''
			this.mode = ''
			this.action = ''
			this.titreModale = ''
			this.colonne = 0
			this.bloc = ''
			this.typeBloc = 'classique'
			this.titre = ''
			this.texte = ''
			this.iframe = ''
			this.vignette = ''
			this.vignetteDefaut = ''
			this.vignetteActivee = true
			this.type = ''
			this.typeExtra = ''
			this.source = ''
			this.media = ''
			this.mediaExtra = ''
			this.medias = []
			this.lien = ''
			this.couleur = '#000000'
			this.progressionFichier = 0
			this.progressionFichierExtra = 0
			this.progressionVignette = 0
			this.progressionFichiers = []
			this.progressionEnregistrement = false
			this.chargementGalerie = false
			this.chargementLien = false
			this.chargementMedia = false
			this.chargementMediaExtra = false
			this.chargementVignette = false
			this.resultats = {}
			this.visibilite = true
			this.visibiliteInitiale = ''
			this.protection = false
			this.motDePasse = ''
			this.donneesBloc = {}
			this.blob = ''
			this.enregistrement = false
			this.mediaRecorder = ''
			this.flux = []
			this.contexte = ''
			this.dureeEnregistrement = '00 : 00'
			if (this.intervalle !== '') {
				clearInterval(this.intervalle)
				this.intervalle = ''
			}
			this.transcodage = false
		},
		afficherSupprimerBloc (bloc, titre, colonne) {
			this.bloc = bloc
			this.titre = titre
			this.colonne = colonne
			this.messageConfirmation = this.$t('confirmationSupprimerCapsule')
			this.typeConfirmation = 'supprimer-bloc'
			this.modaleConfirmer = true
		},
		supprimerBloc () {
			this.modaleConfirmer = false
			this.chargement = true
			this.$socket.emit('supprimerbloc', this.bloc, this.mur.id, this.mur.token, this.titre, this.colonne, this.identifiant, this.nom)
		},
		fermerModaleConfirmer () {
			this.modaleConfirmer = false
			this.commentaireId = ''
			this.titre = ''
			this.messageConfirmation = ''
			this.typeConfirmation = ''
		},
		async afficherEnvoyerBloc (bloc, titre) {
			this.blocId = bloc
			this.titre = titre
			if (Object.keys(this.donneesUtilisateur).length === 0) {
				this.chargement = true
				const reponse = await axios.post(this.hote + '/api/recuperer-donnees-auteur', {
					identifiant: this.identifiant
				}, {
					headers: { 'Content-Type': 'application/json' }
				}).catch(function () {
					this.chargement = false
					this.message = this.$t('erreurCommunicationServeur')
				}.bind(this))
				this.chargement = false
				const mursCrees = reponse.data.mursCrees.filter(function (element) {
					return parseInt(element.id) !== parseInt(this.mur.id)
				}.bind(this))
				mursCrees.sort(function (a, b) {
					const a1 = a.titre.toLowerCase()
					const b1 = b.titre.toLowerCase()
					return a1 < b1 ? -1 : a1 > b1 ? 1 : 0
				})
				const mursAdmins = reponse.data.mursAdmins.filter(function (element) {
					return parseInt(element.id) !== parseInt(this.mur.id)
				}.bind(this))
				mursAdmins.sort(function (a, b) {
					const a1 = a.titre.toLowerCase()
					const b1 = b.titre.toLowerCase()
					return a1 < b1 ? -1 : a1 > b1 ? 1 : 0
				})
				this.donneesUtilisateur.mursCrees = mursCrees
				this.donneesUtilisateur.mursAdmins = mursAdmins
			}
			this.modale = 'copier-bloc'
		},
		verifierColonnesDestination () {
			if (this.murDestination !== '') {
				let colonnes = false
				this.donneesUtilisateur.mursCrees.forEach(function (mur) {
					if (parseInt(mur.id) === parseInt(this.murDestination) && mur.affichage === 'colonnes' && JSON.parse(mur.colonnes).length > 0) {
						colonnes = true
					}
				}.bind(this))
				this.donneesUtilisateur.mursAdmins.forEach(function (mur) {
					if (parseInt(mur.id) === parseInt(this.murDestination) && mur.affichage === 'colonnes' && JSON.parse(mur.colonnes).length > 0) {
						colonnes = true
					}
				}.bind(this))
				return colonnes
			} else {
				return false
			}
		},
		definirNombreColonnesDestination () {
			let colonnes = []
			this.donneesUtilisateur.mursCrees.forEach(function (mur) {
				if (parseInt(mur.id) === parseInt(this.murDestination)) {
					colonnes = JSON.parse(mur.colonnes)
				}
			}.bind(this))
			this.donneesUtilisateur.mursAdmins.forEach(function (mur) {
				if (parseInt(mur.id) === parseInt(this.murDestination)) {
					colonnes = JSON.parse(mur.colonnes)
				}
			}.bind(this))
			return colonnes
		},
		envoyerBloc () {
			if (this.murDestination !== '' && ((this.verifierColonnesDestination() === true && this.colonneDestination !== '') || (this.verifierColonnesDestination() === false && this.colonneDestination === ''))) {
				let donneesBloc = {}
				let token = ''
				let colonneDestination = this.colonneDestination
				this.blocs.forEach(function (item) {
					if (item.bloc === this.blocId) {
						donneesBloc = item
					}
				}.bind(this))
				this.donneesUtilisateur.mursCrees.forEach(function (mur) {
					if (parseInt(mur.id) === parseInt(this.murDestination)) {
						token = mur.token
					}
				}.bind(this))
				this.donneesUtilisateur.mursAdmins.forEach(function (mur) {
					if (parseInt(mur.id) === parseInt(this.murDestination)) {
						token = mur.token
					}
				}.bind(this))
				if (colonneDestination === '') {
					colonneDestination = 0
				}
				if (Object.keys(donneesBloc).length > 0 && token !== '') {
					this.chargement = true
					const id = 'bloc-id-' + (new Date()).getTime() + Math.random().toString(16).slice(10)
					this.$socket.emit('copierbloc', id, donneesBloc.typeBloc, this.murDestination, token, donneesBloc.titre, donneesBloc.texte, donneesBloc.media, donneesBloc.iframe, donneesBloc.type, donneesBloc.source, donneesBloc.vignette, donneesBloc.vignetteActivee, donneesBloc.mediaExtra, donneesBloc.medias, donneesBloc.couleur, colonneDestination, donneesBloc.visibilite, this.identifiant, this.nom, this.mur.id)
					this.fermerModaleCopieBloc()
				}
			}
		},
		fermerModaleCopieBloc () {
			this.modale = ''
			this.blocId = ''
			this.titre = ''
			this.murDestination = ''
			this.colonneDestination = ''
		},
		afficherVisionneuse (item) {
			if (this.panneaux.map(function (e) { return e.id }).includes('panneau_' + item.bloc) === false && (this.action !== 'organiser' || (this.action === 'organiser' && item.titre !== ''))) {
				const imageId = 'image-' + (new Date()).getTime()
				let html
				switch (item.type) {
				case 'image':
					html = '<span id="' + imageId + '" class="image"><img src="/' + this.definirDossierFichiers(this.mur.id) + '/' + this.mur.id + '/' + item.media + '"></span>'
					break
				case 'lien-image':
					html = '<span id="' + imageId + '" class="image"><img src="' + item.media + '"></span>'
					break
				case 'audio':
					html = '<audio controls preload="metadata" src="/' + this.definirDossierFichiers(this.mur.id) + '/' + this.mur.id + '/' + item.media + '"></audio>'
					break
				case 'video':
					html = '<video controls playsinline crossOrigin="anonymous" src="/' + this.definirDossierFichiers(this.mur.id) + '/' + this.mur.id + '/' + item.media + '"></video>'
					break
				case 'pdf':
					html = '<iframe src="/pdfjs/web/viewer.html?file=' + this.hote + '/' + this.definirDossierFichiers(this.mur.id) + '/' + this.mur.id + '/' + item.media + '" allowfullscreen></iframe>'
					break
				case 'document':
				case 'office':
					html = '<iframe src="https://view.officeapps.live.com/op/embed.aspx?src=' + this.hote + '/' + this.definirDossierFichiers(this.mur.id) + '/' + this.mur.id + '/' + item.media + '" allowfullscreen></iframe>'
					break
				case 'embed':
					if (item.source === 'etherpad') {
						html = '<iframe src="' + item.media + '?userName=' + this.nom + '" allowfullscreen></iframe>'
					} else if (this.verifierURL(item.iframe) === true) {
						html = '<iframe src="' + item.iframe + '" allowfullscreen></iframe>'
					} else {
						html = '<div class="html">' + item.iframe + '</div>'
					}
					break
				}
				let galerieId
				if (item.typeBloc === 'galerie') {
					galerieId = 'galerie-' + (new Date()).getTime()
					html = '<div id="' + galerieId + '" class="galerie" tabindex="-1">'
					for (let i = 0; i < item.medias.length; i++) {
						if (item.medias[i].legende !== '') {
							html += '<div class="diapo"><div class="numero">' + (i + 1) + '/' + item.medias.length + '</div><img src="/' + this.definirDossierFichiers(this.mur.id) + '/' + this.mur.id + '/' + item.medias[i].fichier + '"><span class="legende">' + item.medias[i].legende + '</span></div>'
						} else {
							html += '<div class="diapo"><div class="numero">' + (i + 1) + '/' + item.medias.length + '</div><img src="/' + this.definirDossierFichiers(this.mur.id) + '/' + this.mur.id + '/' + item.medias[i].fichier + '"></div>'
						}
					}
					html += '<span class="diapo-precedente" role="button" tabindex="0"><i class="material-icons">navigate_before</i></span><span class="diapo-suivante" role="button" tabindex="0"><i class="material-icons">navigate_next</i></span>'
					html += '</div>'
				}
				this.$nextTick(function () {
					const that = this
					let largeurPanneau = '308px'
					let hauteurPanneau = '300px'
					if (document.querySelector('#page').offsetWidth > 580 && document.querySelector('#page').offsetHeight > 580) {
						largeurPanneau = '508px'
						hauteurPanneau = '500px'
					}
					const snapOptions = this.definirOptionsSnap()
					// eslint-disable-next-line no-undef
					const panneau = jsPanel.create({
						id: 'panneau_' + item.bloc,
						animateIn: 'jsPanelFadeIn',
						animateOut: 'jsPanelFadeOut',
						iconfont: 'material-icons',
						closeOnEscape: true,
						border: '4px solid ' + item.couleur,
						headerTitle: item.titre,
						position: 'center',
						maximizedMargin: 0,
						syncMargins: true,
						resizeit: {
							minWidth: 200,
							minHeight: 150
						},
						panelSize: {
							width: largeurPanneau,
							height: hauteurPanneau
						},
						content: html,
						callback: function (panel) {
							panel.setControlStatus('normalize', 'hide')
							panel.setControlStatus('minimize', 'remove')
							document.querySelector('#masque').classList.add('ouvert')
							if (item.type === 'image' || item.type === 'lien-image') {
								document.querySelector('#' + imageId + ' img').style.maxHeight = document.querySelector('#' + panel.id + ' .jsPanel-content').clientHeight + 'px'
								const image = document.querySelector('#' + imageId)
								// eslint-disable-next-line no-undef
								const panzoom = Panzoom(image, {
									maxScale: 10,
									minScale: 0.5,
									panOnlyWhenZoomed: true
								})
								image.parentElement.addEventListener('wheel', panzoom.zoomWithWheel)
								panel.addControl({
									html: '<span class="material-icons">adjust</span>',
									name: 'dezoom',
									handler: function () {
										document.querySelector('#' + imageId + ' img').style.maxHeight = document.querySelector('#' + panel.id + ' .jsPanel-content').clientHeight + 'px'
										panzoom.reset()
									}
								})
							} else if (item.type === 'audio') {
								panel.resize({
									width: largeurPanneau,
									height: '150px'
								}).reposition()
								panel.addControl({
									html: '<a class="material-icons telecharger" download href="/' + that.definirDossierFichiers(that.mur.id) + '/' + that.mur.id + '/' + item.media + '" target="_blank">file_download</a>',
									name: 'telecharger',
									handler: function () {}
								})
							} else if (item.type === 'embed') {
								panel.addControl({
									html: '<span class="material-icons lien">link</span>',
									name: 'copier-lien',
									handler: function () {
										let lien
										if (item.source === 'etherpad') {
											lien = item.media
										} else if (that.verifierURL(item.iframe) === true) {
											lien = item.iframe
										} else {
											lien = item.iframe.match(/<iframe [^>]*src="[^"]*"[^>]*>/g).map(x => x.replace(/.*src="([^"]*)".*/, '$1'))[0]
										}
										const clipboardLien = new ClipboardJS('#panneau_' + item.bloc + ' .lien', {
											text: function () {
												return lien
											}
										})
										clipboardLien.on('success', function () {
											that.notification = that.$t('lienCopie')
										})
									}
								})
							} else if (item.type === 'pdf' || item.type === 'document' || item.type === 'office') {
								panel.addControl({
									html: '<a class="material-icons telecharger" download href="/' + that.definirDossierFichiers(that.mur.id) + '/' + that.mur.id + '/' + item.media + '" target="_blank">file_download</a>',
									name: 'telecharger',
									handler: function () {}
								})
							} else if (item.typeBloc === 'galerie') {
								let indexGalerie = 0
								document.querySelector('#' + galerieId).addEventListener('keydown', function (event) {
									if (event.key === 'ArrowLeft') {
										afficherDiapoPrecedente()
									} else if (event.key === 'ArrowRight') {
										afficherDiapoSuivante()
									}
								})
								const diapos = document.querySelectorAll('#' + galerieId + ' .diapo')
								diapos.forEach(function (diapo, indexDiapo) {
									if (indexGalerie === indexDiapo) {
										diapo.style.display = 'flex'
									} else {
										diapo.style.display = 'none'
									}
								})
								document.querySelector('#' + galerieId + ' .diapo-precedente').addEventListener('click', function () {
									afficherDiapoPrecedente()
								})
								document.querySelector('#' + galerieId + ' .diapo-suivante').addEventListener('click', function () {
									afficherDiapoSuivante()
								})
								function afficherDiapoPrecedente () {
									if (indexGalerie === 0) {
										indexGalerie = item.medias.length - 1
									} else {
										indexGalerie--
									}
									diapos.forEach(function (diapo, indexDiapo) {
										if (indexGalerie === indexDiapo) {
											diapo.style.display = 'flex'
										} else {
											diapo.style.display = 'none'
										}
									})
								}
								function afficherDiapoSuivante () {
									if (indexGalerie === item.medias.length - 1) {
										indexGalerie = 0
									} else {
										indexGalerie++
									}
									diapos.forEach(function (diapo, indexDiapo) {
										if (indexGalerie === indexDiapo) {
											diapo.style.display = 'flex'
										} else {
											diapo.style.display = 'none'
										}
									})
								}
							}
						},
						onmaximized: function (panel) {
							if (item.type === 'image' || item.type === 'lien-image') {
								document.querySelector('#' + imageId + ' img').style.maxHeight = document.querySelector('#' + panel.id + ' .jsPanel-content').clientHeight + 'px'
							}
						},
						onbeforeclose: function (panel) {
							const panneaux = document.querySelectorAll('.jsPanel')
							if (document.querySelector('#masque') && panneaux.length === 1) {
								document.querySelector('#masque').classList.remove('ouvert')
							}
							this.panneaux.forEach(function (panneau, index) {
								if (panneau.id === panel.id) {
									this.panneaux.splice(index, 1)
								}
							}.bind(this))
							return true
						}.bind(this),
						dragit: {
							snap: snapOptions
						}
					})
					this.panneaux.push(panneau)
				}.bind(this))
			}
		},
		definirOptionsSnap () {
			let snapOptions
			if (window.innerHeight < window.innerWidth) {
				snapOptions = {
					sensitivity: 40,
					repositionOnSnap: true,
					resizeToPreSnap: true,
					snapLeftTop: function (panel) {
						panel.resize({ width: '50%', height: '100%' })
					},
					snapRightTop: function (panel) {
						panel.resize({ width: '50%', height: '100%' })
					},
					snapLeftBottom: function (panel) {
						panel.resize({ width: '50%', height: '100%' })
					},
					snapRightBottom: function (panel) {
						panel.resize({ width: '50%', height: '100%' })
					},
					snapCenterTop: false,
					snapRightCenter: false,
					snapCenterBottom: false,
					snapLeftCenter: false
				}
			} else {
				snapOptions = {
					sensitivity: 15,
					repositionOnSnap: true,
					resizeToPreSnap: true,
					snapCenterTop: function (panel) {
						panel.resize({ width: '100%', height: '50%' })
					},
					snapCenterBottom: function (panel) {
						panel.resize({ width: '100%', height: '50%' })
					},
					snapLeftTop: false,
					snapRightCenter: false,
					snapRightBottom: false,
					snapRightTop: false,
					snapLeftBottom: false,
					snapLeftCenter: false
				}
			}
			return snapOptions
		},
		activerDefilementHorizontal () {
			const mur = document.querySelector('#mur')
			mur.addEventListener('mousedown', this.defilementHorizontalDebut)
			mur.addEventListener('mouseleave', this.defilementHorizontalFin)
			mur.addEventListener('mouseup', this.defilementHorizontalFin)
			mur.addEventListener('mousemove', this.defilementHorizontalEnCours)
		},
		desactiverDefilementHorizontal () {
			const mur = document.querySelector('#mur')
			mur.removeEventListener('mousedown', this.defilementHorizontalDebut)
			mur.removeEventListener('mouseleave', this.defilementHorizontalFin)
			mur.removeEventListener('mouseup', this.defilementHorizontalFin)
			mur.removeEventListener('mousemove', this.defilementHorizontalEnCours)
		},
		defilementHorizontalDebut (event) {
			const mur = document.querySelector('#mur')
			this.defilement = true
			this.depart = event.pageX - mur.offsetLeft
			this.distance = mur.scrollLeft
		},
		defilementHorizontalFin () {
			this.defilement = false
		},
		defilementHorizontalEnCours (event) {
			if (!this.defilement) { return }
			event.preventDefault()
			const mur = document.querySelector('#mur')
			const x = event.pageX - mur.offsetLeft
			const delta = (x - this.depart) * 1.5
			mur.scrollLeft = this.distance - delta
		},
		definirClasseOrganiser () {
			if (this.blocs.length > 1 || (this.mur.affichage === 'colonnes' && this.mur.colonnes.length > 1)) {
				return true
			} else {
				return false
			}
		},
		activerModeOrganiser () {
			if (this.blocs.length > 1 || (this.mur.affichage === 'colonnes' && this.mur.colonnes.length > 1)) {
				this.chargement = true
				this.menu = ''
				this.recherche = false
				setTimeout(function () {
					this.chargement = false
					this.action = 'organiser'
					this.notification = this.$t('modeOrganiserActive')
				}.bind(this), 100)
			}
		},
		desactiverModeOrganiser () {
			this.chargement = true
			this.menu = ''
			this.recherche = false
			setTimeout(function () {
				this.chargement = false
				this.action = ''
				this.notification = this.$t('modeOrganiserDesactive')
			}.bind(this), 100)
		},
		afficherModaleDiaporama () {
			if (this.blocs.length > 0) {
				this.panneaux.forEach(function (panneau) {
					panneau.close()
				})
				this.panneaux = []
				this.chargement = true
				let donneesBloc = {}
				const blocActif = document.querySelector('.bloc.actif')
				if (blocActif) {
					const bloc = blocActif.id
					this.blocs.forEach(function (item) {
						if (item.bloc === bloc) {
							donneesBloc = item
						}
					})
				} else {
					donneesBloc = this.blocs[0]
					this.definirBlocActif(donneesBloc.bloc)
				}
				this.donneesBloc = donneesBloc
				this.menu = ''
				this.modale = 'diaporama'
				if (this.mur.commentaires === 'actives') {
					this.$socket.emit('commentaires', donneesBloc.bloc, 'diapositive')
				} else {
					this.$nextTick(function () {
						this.chargerDiapositive()
					}.bind(this))
				}
			}
		},
		afficherBlocPrecedent () {
			this.chargement = true
			this.commentaire = ''
			const bloc = this.donneesBloc.bloc
			let indexBloc = 0
			this.blocs.forEach(function (item, index) {
				if (item.bloc === bloc) {
					indexBloc = index
				}
			})
			indexBloc--
			if (indexBloc === -1) {
				this.donneesBloc = this.blocs[this.blocs.length - 1]
			} else {
				this.donneesBloc = this.blocs[indexBloc]
			}
			this.definirBlocActif(this.donneesBloc.bloc)
			if (this.mur.commentaires === 'actives') {
				this.$socket.emit('commentaires', this.donneesBloc.bloc, 'diapositive')
			} else {
				this.chargerDiapositive()
			}
		},
		afficherBlocSuivant () {
			this.chargement = true
			this.commentaire = ''
			const bloc = this.donneesBloc.bloc
			let indexBloc = 0
			this.blocs.forEach(function (item, index) {
				if (item.bloc === bloc) {
					indexBloc = index
				}
			})
			indexBloc++
			if (indexBloc === this.blocs.length) {
				this.donneesBloc = this.blocs[0]
			} else {
				this.donneesBloc = this.blocs[indexBloc]
			}
			this.definirBlocActif(this.donneesBloc.bloc)
			if (this.mur.commentaires === 'actives') {
				this.$socket.emit('commentaires', this.donneesBloc.bloc, 'diapositive')
			} else {
				this.chargerDiapositive()
			}
		},
		definirBlocActif (bloc) {
			const blocActif = document.querySelector('.bloc.actif')
			if (blocActif) {
				blocActif.classList.remove('actif')
			}
			if (document.querySelector('#' + bloc)) {
				document.querySelector('#' + bloc).classList.add('actif')
			}
		},
		definirTypeMedia () {
			if (this.donneesBloc.source === 'youtube' || this.donneesBloc.source === 'vimeo' || this.donneesBloc.source === 'dailymotion' || this.donneesBloc.source === 'digiview') {
				return 'video'
			} else if (this.donneesBloc.source === 'slideshare' || this.donneesBloc.source === 'soundcloud' || this.donneesBloc.media.includes('clyp.it') || this.donneesBloc.media.includes('vocaroo.com') || this.donneesBloc.media.includes('voca.ro')) {
				return 'embed'
			} else {
				return 'document'
			}
		},
		chargerDiapositive () {
			const contenuCharge = function () {
				this.chargement = false
				this.$nextTick(function () {
					document.querySelector('#diapositive .contenu').style.height = document.querySelector('#diapositive').clientHeight - this.convertirRem(5) + 'px'
					if (this.mur.commentaires === 'actives') {
						this.genererEditeur()
					}
				}.bind(this))
			}.bind(this)
			if (document.querySelector('#diapositive')) {
				document.querySelector('#diapositive .contenu').removeAttribute('style')
				switch (this.donneesBloc.type) {
				case 'audio':
					this.$nextTick(function () {
						const audio = document.querySelector('#diapositive audio')
						audio.addEventListener('loadedmetadata', function () {
							contenuCharge()
						})
						if (audio.readyState >= 2) {
							contenuCharge()
						}
					})
					break
				case 'video':
					this.$nextTick(function () {
						const video = document.querySelector('#diapositive video')
						video.addEventListener('loadedmetadata', function () {
							contenuCharge()
						})
						if (video.readyState >= 2) {
							contenuCharge()
						}
					})
					break
				default:
					this.$nextTick(function () {
						imagesLoaded('#diapositive', function () {
							contenuCharge()
						})
					})
					break
				}
			} else {
				this.chargement = false
			}
		},
		fermerModaleDiaporama () {
			this.modale = ''
			this.commentaires = []
			this.commentaire = ''
			this.commentaireId = ''
			this.commentaireModifie = ''
			this.editeurCommentaire = ''
			this.emojis = ''
			this.donneesBloc = {}
		},
		ouvrirModaleAdmins () {
			this.menu = ''
			this.admins = JSON.parse(JSON.stringify(this.mur.admins))
			this.motDePasseAdmin = this.mur.motdepasseAdmin
			this.modale = 'admins'
		},
		ajouterAdmin () {
			const identifiantAdmin = document.querySelector('#ajouter-admin input').value.trim()
			if (identifiantAdmin !== '' && this.identifiant !== identifiantAdmin && !this.admins.includes(identifiantAdmin)) {
				this.chargement = true
				axios.post(this.hote + '/api/verifier-identifiant', {
					identifiant: identifiantAdmin
				}).then(function (reponse) {
					this.chargement = false
					const donnees = reponse.data
					if (donnees === 'erreur') {
						this.message = this.$t('erreurCommunicationServeur')
					} else if (donnees === 'identifiant_non_valide') {
						this.message = this.$t('identifiantNonValide')
					} else {
						this.admins.push(identifiantAdmin)
					}
					document.querySelector('#ajouter-admin input').value = ''
				}.bind(this)).catch(function () {
					this.chargement = false
					this.message = this.$t('erreurCommunicationServeur')
				}.bind(this))
			}
		},
		supprimerAdmin (identifiantAdmin) {
			const index = this.admins.indexOf(identifiantAdmin)
			this.admins.splice(index, 1)
		},
		modifierAdmins () {
			if (this.admins.toString() !== this.mur.admins.toString() || this.motDePasseAdmin !== '') {
				this.modale = ''
				this.$socket.emit('modifieradmins', this.mur.id, this.admins, this.motDePasseAdmin, this.identifiant)
				this.chargement = true
			}
		},
		fermerModaleAdmins () {
			this.modale = ''
			this.admins = []
			this.motDePasseAdmin = ''
			this.motDePasseVisible = false
		},
		verrouillerBloc (bloc) {
			if (this.admin) {
				this.$socket.emit('verrouillerbloc', this.mur.id, bloc, this.colonne, this.identifiant)
				this.chargement = true
			}
		},
		deverrouillerBloc (bloc) {
			if (this.admin) {
				this.$socket.emit('deverrouillerbloc', this.mur.id, bloc, this.colonne, this.identifiant)
				this.chargement = true
			}
		},
		ouvrirModaleCommentaires (bloc, titre) {
			this.chargement = true
			this.bloc = bloc
			this.titre = titre
			this.$socket.emit('commentaires', bloc, 'discussion')
		},
		envoyerCommentaire (event) {
			event.preventDefault()
			let bloc = this.bloc
			if (Object.keys(this.donneesBloc).length > 0) {
				bloc = this.donneesBloc.bloc
			}
			if (this.commentaire !== '') {
				this.$socket.emit('commenterbloc', bloc, this.mur.id, this.titre, this.commentaire, this.identifiant, this.nom)
				this.commentaire = ''
				this.commentaireId = ''
				this.commentaireModifie = ''
				this.editeurCommentaire.content.innerHTML = ''
				this.emojis = ''
			}
		},
		afficherModifierCommentaire (id, texte) {
			this.commentaireId = id
			this.commentaireModifie = texte
			this.editionCommentaire = true
			this.emojis = ''
			this.$nextTick(function () {
				const actions = this.definirActionsEditeur('commentaire-modifie')
				const editeur = pell.init({
					element: document.querySelector('#commentaire-modifie'),
					onChange: function (html) {
						let commentaire = html.replace(/(<a [^>]*)(target="[^"]*")([^>]*>)/gi, '$1$3')
						commentaire = commentaire.replace(/(<a [^>]*)(>)/gi, '$1 target="_blank"$2')
						commentaire = linkifyHtml(commentaire, {
							defaultProtocol: 'https',
							target: '_blank'
						})
						this.commentaireModifie = commentaire
					}.bind(this),
					actions: actions,
					classes: { actionbar: 'boutons-editeur-commentaire', button: 'bouton-editeur', content: 'contenu-editeur-commentaire', selected: 'bouton-actif' }
				})
				editeur.content.innerHTML = this.commentaireModifie
				editeur.onpaste = function (event) {
					event.preventDefault()
					event.stopPropagation()
					let html = event.clipboardData.getData('text/html')
					if (html !== '') {
						html = stripTags(html, ['b', 'i', 'u', 'a', 'br', 'div', 'font', 'ul', 'ol'])
						html = html.replace(/style=".*?"/mg, '')
						html = html.replace(/class=".*?"/mg, '')
						pell.exec('insertHTML', html)
					} else {
						pell.exec('insertText', event.clipboardData.getData('text/plain'))
					}
				}
				document.querySelector('#couleur-texte-commentaire-modifie').addEventListener('change', this.modifierCouleurCommentaireModifie)
			}.bind(this))
		},
		annulerModifierCommentaire () {
			this.commentaireId = ''
			this.commentaireModifie = ''
			this.editionCommentaire = false
			this.emojis = ''
		},
		modifierCommentaire () {
			let bloc = this.bloc
			if (Object.keys(this.donneesBloc).length > 0) {
				bloc = this.donneesBloc.bloc
			}
			this.$socket.emit('modifiercommentaire', bloc, this.mur.id, this.commentaireId, this.commentaireModifie, this.identifiant)
			this.commentaireId = ''
			this.commentaireModifie = ''
			this.editionCommentaire = false
			this.emojis = ''
		},
		afficherSupprimerCommentaire (id) {
			this.editionCommentaire = false
			this.commentaireId = id
			this.messageConfirmation = this.$t('confirmationSupprimerCommentaire')
			this.typeConfirmation = 'supprimer-commentaire'
			this.modaleConfirmer = true
		},
		supprimerCommentaire () {
			this.modaleConfirmer = false
			let bloc = this.bloc
			if (Object.keys(this.donneesBloc).length > 0) {
				bloc = this.donneesBloc.bloc
			}
			this.$socket.emit('supprimercommentaire', bloc, this.mur.id, this.commentaireId, this.identifiant)
			this.fermerModaleConfirmer()
		},
		genererEditeur () {
			if (this.editeurCommentaire === '') {
				const actions = this.definirActionsEditeur('commentaire')
				this.editeurCommentaire = pell.init({
					element: document.querySelector('#commentaire'),
					onChange: function (html) {
						let commentaire = html.replace(/(<a [^>]*)(target="[^"]*")([^>]*>)/gi, '$1$3')
						commentaire = commentaire.replace(/(<a [^>]*)(>)/gi, '$1 target="_blank"$2')
						commentaire = linkifyHtml(commentaire, {
							defaultProtocol: 'https',
							target: '_blank'
						})
						this.commentaire = commentaire
					}.bind(this),
					actions: actions,
					classes: { actionbar: 'boutons-editeur-commentaire', button: 'bouton-editeur', content: 'contenu-editeur-commentaire', selected: 'bouton-actif' }
				})
				this.editeurCommentaire.onpaste = function (event) {
					event.preventDefault()
					event.stopPropagation()
					let html = event.clipboardData.getData('text/html')
					if (html !== '') {
						html = stripTags(html, ['b', 'i', 'u', 'a', 'br', 'div', 'font', 'ul', 'ol'])
						html = html.replace(/style=".*?"/mg, '')
						html = html.replace(/class=".*?"/mg, '')
						pell.exec('insertHTML', html)
					} else {
						pell.exec('insertText', event.clipboardData.getData('text/plain'))
					}
				}
				document.querySelector('#couleur-texte-commentaire').addEventListener('change', this.modifierCouleurCommentaire)
			}
		},
		definirActionsEditeur (type) {
			const actions = [
				{ name: 'gras', title: this.$t('gras'), icon: '<i class="material-icons">format_bold</i>', result: () => pell.exec('bold') },
				{ name: 'italique', title: this.$t('italique'), icon: '<i class="material-icons">format_italic</i>', result: () => pell.exec('italic') },
				{ name: 'souligne', title: this.$t('souligne'), icon: '<i class="material-icons">format_underlined</i>', result: () => pell.exec('underline') },
				{ name: 'barre', title: this.$t('barre'), icon: '<i class="material-icons">format_strikethrough</i>', result: () => pell.exec('strikethrough') },
				{ name: 'couleur', title: this.$t('couleurTexte'), icon: '<label for="couleur-texte-' + type + '"><i class="material-icons">format_color_text</i></label><input id="couleur-texte-' + type + '" type="color">', result: () => undefined },
				{ name: 'lien', title: this.$t('lien'), icon: '<i class="material-icons">link</i>', result: () => { const url = window.prompt(this.$t('adresseLien')); if (url) { pell.exec('createLink', url) } } },
				{ name: 'emojis', title: this.$t('emoticones'), icon: '<i class="material-icons">insert_emoticon</i>', result: function () { this.afficherEmojis(type) }.bind(this) }
			]
			return actions
		},
		afficherEmojis (type) {
			if (type === 'commentaire' && this.emojis !== 'commentaire') {
				this.emojis = 'commentaire'
			} else if (type === 'commentaire' && this.emojis === 'commentaire') {
				this.emojis = ''
			} else if (type === 'commentaire-modifie' && this.emojis !== 'commentaire-modifie') {
				this.emojis = 'commentaire-modifie'
			} else if (type === 'commentaire-modifie' && this.emojis === 'commentaire-modifie') {
				this.emojis = ''
			}
		},
		insererEmoji (emoji) {
			pell.exec('insertText', emoji)
		},
		fermerModaleCommentaire () {
			this.modale = ''
			this.commentaires = []
			this.commentaire = ''
			this.commentaireId = ''
			this.commentaireModifie = ''
			this.editeurCommentaire = ''
			this.editionCommentaire = false
			this.emojis = ''
			this.bloc = ''
			this.titre = ''
		},
		verifierUtilisateurEvaluation (evaluations) {
			if (evaluations && evaluations.length > 0) {
				let capsuleEvaluee = false
				evaluations.forEach(function (evaluation) {
					if (evaluation.identifiant === this.identifiant) {
						capsuleEvaluee = true
					}
				}.bind(this))
				return capsuleEvaluee
			} else {
				return false
			}
		},
		definirEvaluationCapsule (evaluations) {
			if (evaluations && evaluations.length > 0) {
				let note = 0
				evaluations.forEach(function (evaluation) {
					note = note + evaluation.etoiles
				})
				if (note > 0) {
					return Math.round(note / evaluations.length)
				} else {
					return 0
				}
			} else {
				return 0
			}
		},
		ouvrirModaleEvaluations (bloc, titre, evaluations) {
			this.bloc = bloc
			this.titre = titre
			if (evaluations !== '') {
				this.evaluations = evaluations
				evaluations.forEach(function (evaluation) {
					if (evaluation.identifiant === this.identifiant) {
						this.evaluationId = evaluation.id
						this.evaluation = evaluation.etoiles
					}
				}.bind(this))
			}
			this.modale = 'evaluations'
		},
		envoyerEvaluation () {
			let bloc = this.bloc
			if (Object.keys(this.donneesBloc).length > 0) {
				bloc = this.donneesBloc.bloc
			} else {
				this.chargement = true
			}
			this.$socket.emit('evaluerbloc', bloc, this.mur.id, this.titre, this.evaluation, this.identifiant, this.nom)
			this.fermerModaleEvaluations()
		},
		modifierEvaluation () {
			let bloc = this.bloc
			if (Object.keys(this.donneesBloc).length > 0) {
				bloc = this.donneesBloc.bloc
			} else {
				this.chargement = true
			}
			if (this.evaluation === 0) {
				this.$socket.emit('supprimerevaluation', bloc, this.mur.id, this.evaluationId, this.identifiant)
			} else {
				this.$socket.emit('modifierevaluation', bloc, this.mur.id, this.evaluationId, this.evaluation, this.identifiant)
			}
			this.fermerModaleEvaluations()
		},
		fermerModaleEvaluations () {
			this.modale = ''
			this.evaluations = []
			this.evaluation = 0
			this.evaluationId = ''
			this.bloc = ''
			this.titre = ''
		},
		demarrerDeplacerBloc () {
			if (this.mur.affichage === 'colonnes') {
				this.desactiverDefilementHorizontal()
				this.defilement = false
				this.depart = 0
				this.distance = 0
			}
		},
		deplacerBloc (event) {
			this.chargement = true
			if (this.mur.affichage === 'colonnes') {
				this.activerDefilementHorizontal()
				const blocs = []
				this.colonnes.forEach(function (colonne, indexColonne) {
					colonne.forEach(function (bloc, indexBloc) {
						colonne[indexBloc].colonne = indexColonne
					})
					blocs.push(...colonne)
				})
				this.blocs = blocs
			}
			this.$socket.emit('deplacerbloc', this.blocs, this.mur.id, this.mur.affichage, this.mur.ordre, this.identifiant)
			this.$nextTick(function () {
				const blocsActifs = document.querySelectorAll('.bloc.actif')
				if (blocsActifs.length > 0) {
					blocsActifs.forEach(function (bloc) {
						bloc.classList.remove('actif')
					})
				}
				let indexBloc
				if (this.mur.affichage === 'colonnes') {
					const indexColonne = event.to.getAttribute('data-index')
					indexBloc = event.newIndex
					if (this.colonnes[indexColonne][indexBloc] && this.colonnes[indexColonne][indexBloc].bloc) {
						document.querySelector('#' + this.colonnes[indexColonne][indexBloc].bloc).classList.add('actif')
					}
				} else {
					indexBloc = event.newIndex
					if (this.blocs[indexBloc] && this.blocs[indexBloc].bloc) {
						document.querySelector('#' + this.blocs[indexBloc].bloc).classList.add('actif')
					}
				}
			}.bind(this))
		},
		surlignerBloc (event) {
			const blocActif = document.querySelector('.bloc.actif')
			if (blocActif && document.querySelector('#mur').contains(event.target)) {
				blocActif.classList.remove('actif')
			}
			const element = event.target.closest('.bloc') || event.target.closest('li')
			if (element && element.hasAttribute('data-bloc')) {
				if (blocActif) {
					blocActif.classList.remove('actif')
				}
				const id = element.getAttribute('data-bloc')
				if (document.querySelector('#' + id)) {
					document.querySelector('#' + id).classList.add('actif')
					if (document.querySelector('#entrees') && document.querySelector('#entrees').contains(event.target)) {
						document.querySelector('#' + id).scrollIntoView()
					}
				}
			}
		},
		verifierMotDePasseBloc (bloc, colonne) {
			let motdepasse = ''
			if (this.modale === 'diaporama') {
				motdepasse = document.querySelector('#diapositive .motdepasse input').value
			} else {
				motdepasse = document.querySelector('#' + bloc + ' .motdepasse input').value
			}
			if (motdepasse && motdepasse !== '') {
				if (this.mur.affichage === 'colonnes') {
					this.colonnes[colonne].forEach(function (item, index) {
						if (item.bloc === bloc && item.motdepasse === motdepasse) {
							this.colonnes[colonne][index].visibilite = 'visible'
						}
					}.bind(this))
				}
				if (this.modale === 'diaporama' && this.donneesBloc.motdepasse === motdepasse) {
					this.donneesBloc.visibilite = 'visible'
					this.$nextTick(function () {
						this.chargerDiapositive()
					}.bind(this))
				}
				this.blocs.forEach(function (item) {
					if (item.bloc === bloc && item.motdepasse === motdepasse) {
						item.visibilite = 'visible'
						if (!this.admin) {
							this.$socket.emit('autoriserblocprotege', bloc, this.identifiant)
							this.notification = this.$t('capsuleDeverrouillee')
						} else {
							item.protection = true
						}
					}
				}.bind(this))
			}
		},
		redimensionner () {
			const diapositive = document.querySelector('#diapositive')
			if (diapositive) {
				const contenuDiapositive = document.querySelector('#diapositive .contenu')
				contenuDiapositive.removeAttribute('style')
				this.$nextTick(function () {
					contenuDiapositive.style.height = diapositive.clientHeight - this.convertirRem(5) + 'px'
				}.bind(this))
			}
			const blocs = document.querySelector('#blocs')
			if (blocs) {
				this.$nextTick(function () {
					blocs.classList.add('anime')
					blocs.addEventListener('animationend', function () {
						blocs.classList.remove('anime')
					})
				})
			}
			if (this.enregistrement === true) {
				this.$nextTick(function () {
					const largeur = document.querySelector('#enregistrement').offsetWidth
					const canvas = document.querySelector('#visualisation')
					canvas.width = largeur
				})
			}
		},
		afficherActivite () {
			if (this.menu === 'activite') {
				this.menu = ''
			} else {
				this.menu = 'activite'
			}
		},
		afficherChat () {
			if (this.menu === 'chat') {
				this.menu = ''
			} else {
				this.menu = 'chat'
			}
			this.nouveauxMessagesChat = 0
		},
		afficherOptions () {
			if (this.menu === 'options') {
				this.menu = ''
			} else {
				this.menu = 'options'
			}
		},
		afficherUtilisateurs () {
			this.listeCouleurs = false
			if (this.menu === 'utilisateurs') {
				this.menu = ''
			} else {
				this.menu = 'utilisateurs'
			}
		},
		envoyerMessage () {
			if (this.messageChat !== '') {
				this.$socket.emit('messagechat', this.mur.id, this.messageChat, this.identifiant, this.nom)
				this.messageChat = ''
			}
		},
		afficherReinitialiserMessages () {
			this.messageConfirmation = this.$t('confirmationSupprimerMessages')
			this.typeConfirmation = 'reinitialiser-messages'
			this.modaleConfirmer = true
		},
		reinitialiserMessages () {
			this.$socket.emit('reinitialisermessages', this.mur.id, this.identifiant)
			this.chargement = true
			this.menu = ''
			this.fermerModaleConfirmer()
		},
		afficherReinitialiserActivite () {
			this.messageConfirmation = this.$t('confirmationSupprimerActivite')
			this.typeConfirmation = 'reinitialiser-activite'
			this.modaleConfirmer = true
		},
		reinitialiserActivite () {
			this.$socket.emit('reinitialiseractivite', this.mur.id, this.identifiant)
			this.chargement = true
			this.menu = ''
			this.fermerModaleConfirmer()
		},
		supprimerActivite (id) {
			this.$socket.emit('supprimeractivite', this.mur.id, id, this.identifiant)
			this.chargement = true
		},
		modifierTitre () {
			const titre = document.querySelector('#titre-mur').value
			if (this.mur.titre !== titre && titre !== '') {
				this.$socket.emit('modifiertitre', this.mur.id, titre, this.identifiant)
				this.chargement = true
			}
		},
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
		afficherCodeQR () {
			this.modale = 'code-qr'
			this.$nextTick(function () {
				// eslint-disable-next-line
				this.codeqr = new QRCode('qr', {
					text: this.hote + '/w/' + this.mur.id + '/' + this.mur.token + '/' + this.mur.slug,
					width: 360,
					height: 360,
					colorDark: '#000000',
					colorLight: '#ffffff',
					// eslint-disable-next-line
					correctLevel : QRCode.CorrectLevel.H
				})
			}.bind(this))
		},
		fermerModaleCodeQR () {
			this.modale = ''
		},
		modifierAcces (acces) {
			if (this.mur.acces !== acces) {
				this.$socket.emit('modifieracces', this.mur.id, acces, this.identifiant)
				this.chargement = true
			}
		},
		afficherCodeAcces () {
			this.codeVisible = true
		},
		masquerCodeAcces () {
			this.modificationCode = false
			this.codeVisible = false
		},
		afficherModifierCodeAcces () {
			this.codeVisible = true
			this.modificationCode = true
		},
		annulerModifierCodeAcces () {
			this.codeVisible = false
			this.modificationCode = false
		},
		modifierCodeAcces () {
			const code = document.querySelector('#code-acces input').value
			if (this.mur.code !== code && code !== '') {
				this.$socket.emit('modifiercodeacces', this.mur.id, code, this.identifiant)
				this.chargement = true
			}
		},
		verifierCodeAcces () {
			this.chargement = true
			axios.post(this.hote + '/api/verifier-code-acces', {
				mur: this.mur.id,
				code: this.codeAcces
			}).then(function (reponse) {
				const donnees = reponse.data
				if (donnees === 'code_incorrect') {
					this.chargement = false
					this.message = this.$t('codePasCorrect')
				} else if (donnees === 'erreur') {
					this.chargement = false
					this.message = this.$t('erreurCommunicationServeur')
				} else {
					this.chargement = false
					this.accesAutorise = true
					this.$socket.emit('connexion', { mur: this.mur.id, identifiant: this.identifiant, nom: this.nom })
					this.fermerModaleCodeAcces()
				}
			}.bind(this)).catch(function () {
				this.chargement = false
				this.message = this.$t('erreurCommunicationServeur')
			}.bind(this))
		},
		fermerModaleCodeAcces () {
			this.codeAcces = ''
			this.modale = ''
		},
		modifierContributions (contributions) {
			if (this.mur.contributions !== contributions) {
				this.$socket.emit('modifiercontributions', this.mur.id, contributions, this.mur.contributions, this.identifiant)
				this.chargement = true
			}
		},
		modifierAffichage (affichage) {
			if (this.mur.affichage !== affichage) {
				this.$socket.emit('modifieraffichage', this.mur.id, affichage, this.identifiant)
				this.chargement = true
			}
		},
		modifierOrdre (ordre) {
			if (this.mur.ordre !== ordre) {
				this.$socket.emit('modifierordre', this.mur.id, ordre, this.identifiant)
				this.chargement = true
			}
		},
		modifierLargeur (largeur) {
			if (this.mur.largeur !== largeur) {
				this.$socket.emit('modifierlargeur', this.mur.id, largeur, this.identifiant)
				this.chargement = true
			}
		},
		modifierFond (fond) {
			if (this.mur.fond !== fond) {
				this.$socket.emit('modifierfond', this.mur.id, '/img/' + fond, this.mur.fond, this.identifiant)
				this.chargement = true
			}
		},
		modifierCouleurFond (event) {
			if (this.mur.fond !== event.target.value) {
				this.$socket.emit('modifiercouleurfond', this.mur.id, event.target.value, this.mur.fond, this.identifiant)
				this.chargement = true
			}
		},
		ajouterFond () {
			const champ = document.querySelector('#televerser-fond')
			const formats = ['jpg', 'jpeg', 'png', 'gif']
			const extension = champ.files[0].name.substring(champ.files[0].name.lastIndexOf('.') + 1).toLowerCase()
			if (champ.files && champ.files[0] && formats.includes(extension)) {
				this.chargement = true
				const fichier = champ.files[0]
				const formulaire = new FormData()
				formulaire.append('mur', this.mur.id)
				formulaire.append('fichier', fichier)
				axios.post(this.hote + '/api/televerser-fond', formulaire, {
					headers: {
						'Content-Type': 'multipart/form-data'
					},
					onUploadProgress: function (progression) {
						const pourcentage = parseInt(Math.round((progression.loaded * 100) / progression.total))
						this.progressionFond = pourcentage
					}.bind(this)
				}).then(function (reponse) {
					const donnees = reponse.data
					if (donnees === 'non_connecte') {
						window.location.replace('/')
					} else if (donnees === 'erreur_televersement') {
						champ.value = ''
						this.progressionFond = 0
						this.message = this.$t('erreurTeleversementFichier')
					} else {
						this.$socket.emit('modifierfond', this.mur.id, donnees, this.mur.fond, this.identifiant)
					}
					this.progressionFond = 0
					champ.value = ''
				}.bind(this)).catch(function () {
					champ.value = ''
					this.progressionFond = 0
					this.message = this.$t('erreurCommunicationServeur')
				}.bind(this))
			} else {
				this.message = this.$t('formatFichierPasAccepte')
				champ.value = ''
			}
		},
		modifierActivite (event) {
			if (event.target.checked === true) {
				this.$socket.emit('modifieractivite', this.mur.id, 'active', this.identifiant)
			} else {
				this.$socket.emit('modifieractivite', this.mur.id, 'desactive', this.identifiant)
			}
			this.chargement = true
		},
		modifierConversation (event) {
			if (event.target.checked === true) {
				this.$socket.emit('modifierconversation', this.mur.id, 'activee', this.identifiant)
			} else {
				this.$socket.emit('modifierconversation', this.mur.id, 'desactivee', this.identifiant)
			}
			this.chargement = true
		},
		modifierListeUtilisateurs (event) {
			if (event.target.checked === true) {
				this.$socket.emit('modifierlisteutilisateurs', this.mur.id, 'activee', this.identifiant)
			} else {
				this.$socket.emit('modifierlisteutilisateurs', this.mur.id, 'desactivee', this.identifiant)
			}
			this.chargement = true
		},
		modifierEditionNom (event) {
			if (event.target.checked === true) {
				this.$socket.emit('modifiereditionnom', this.mur.id, 'activee', this.identifiant)
			} else {
				this.$socket.emit('modifiereditionnom', this.mur.id, 'desactivee', this.identifiant)
			}
			this.chargement = true
		},
		modifierFichiers (event) {
			if (event.target.checked === true) {
				this.$socket.emit('modifierfichiers', this.mur.id, 'actives', this.identifiant)
			} else {
				this.$socket.emit('modifierfichiers', this.mur.id, 'desactives', this.identifiant)
			}
			this.chargement = true
		},
		modifierEnregistrements (event) {
			if (event.target.checked === true) {
				this.$socket.emit('modifierenregistrements', this.mur.id, 'actives', this.identifiant)
			} else {
				this.$socket.emit('modifierenregistrements', this.mur.id, 'desactives', this.identifiant)
			}
			this.chargement = true
		},
		modifierLiens (event) {
			if (event.target.checked === true) {
				this.$socket.emit('modifierliens', this.mur.id, 'actives', this.identifiant)
			} else {
				this.$socket.emit('modifierliens', this.mur.id, 'desactives', this.identifiant)
			}
			this.chargement = true
		},
		modifierDocuments (event) {
			if (event.target.checked === true) {
				this.$socket.emit('modifierdocuments', this.mur.id, 'actives', this.identifiant)
			} else {
				this.$socket.emit('modifierdocuments', this.mur.id, 'desactives', this.identifiant)
			}
			this.chargement = true
		},
		modifierCommentaires (event) {
			if (event.target.checked === true) {
				this.$socket.emit('modifiercommentaires', this.mur.id, 'actives', this.identifiant)
			} else {
				this.$socket.emit('modifiercommentaires', this.mur.id, 'desactives', this.identifiant)
			}
			this.chargement = true
		},
		modifierEvaluations (event) {
			if (event.target.checked === true) {
				this.$socket.emit('modifierevaluations', this.mur.id, 'activees', this.identifiant)
			} else {
				this.$socket.emit('modifierevaluations', this.mur.id, 'desactivees', this.identifiant)
			}
			this.chargement = true
		},
		modifierVerrouillage (event) {
			if (event.target.checked === true) {
				this.$socket.emit('modifierverrouillage', this.mur.id, 'active', this.identifiant)
			} else {
				this.$socket.emit('modifierverrouillage', this.mur.id, 'desactive', this.identifiant)
			}
			this.chargement = true
		},
		modifierCopieBloc (event) {
			if (event.target.checked === true) {
				this.$socket.emit('modifiercopiebloc', this.mur.id, 'activee', this.identifiant)
			} else {
				this.$socket.emit('modifiercopiebloc', this.mur.id, 'desactivee', this.identifiant)
			}
			this.chargement = true
		},
		fermerMenuOptions () {
			this.menu = ''
			if (document.querySelector('#titre-mur')) {
				document.querySelector('#titre-mur').value = this.mur.titre
			}
			this.codeVisible = false
		},
		afficherModifierNom () {
			this.nomUtilisateur = this.nom
			this.modale = 'modifier-nom'
			this.$nextTick(function () {
				document.querySelector('#champ-nom').focus()
			})
		},
		modifierNom () {
			const nom = this.nomUtilisateur
			if (nom !== '') {
				this.$socket.emit('modifiernom', this.mur.id, nom, this.statut, this.identifiant)
				this.chargement = true
				this.fermerModaleModifierNom()
			}
		},
		fermerModaleModifierNom () {
			this.modale = ''
			this.nomUtilisateur = ''
		},
		modifierCaracteristique (identifiant, caracteristique, valeur) {
			this.blocs.forEach(function (item) {
				if (item.identifiant === identifiant && item.hasOwnProperty(caracteristique)) {
					item[caracteristique] = valeur
				}
			})
			this.commentaires.forEach(function (commentaire) {
				if (commentaire.identifiant === identifiant && commentaire.hasOwnProperty(caracteristique)) {
					commentaire[caracteristique] = valeur
				}
			})
			this.activite.forEach(function (entree) {
				if (entree.identifiant === identifiant && entree.hasOwnProperty(caracteristique)) {
					entree[caracteristique] = valeur
				}
			})
			this.messagesChat.forEach(function (message) {
				if (message.identifiant === identifiant && message.hasOwnProperty(caracteristique)) {
					message[caracteristique] = valeur
				}
			})
			this.utilisateurs.forEach(function (utilisateur) {
				if (utilisateur.identifiant === identifiant && utilisateur.hasOwnProperty(caracteristique)) {
					utilisateur[caracteristique] = valeur
				}
			})
		},
		eclaircirCouleur (hex) {
			if (hex && hex.substring(0, 1) === '#') {
				const r = parseInt(hex.slice(1, 3), 16)
				const v = parseInt(hex.slice(3, 5), 16)
				const b = parseInt(hex.slice(5, 7), 16)
				return 'rgba(' + r + ', ' + v + ', ' + b + ', ' + 0.15 + ')'
			} else {
				return 'transparent'
			}
		},
		convertirRem (rem) {
			return rem * parseFloat(getComputedStyle(document.documentElement).fontSize)
		},
		deconnexion () {
			const identifiant = this.identifiant
			axios.post(this.hote + '/api/deconnexion').then(function () {
				this.$socket.emit('deconnexion', identifiant)
				window.location.replace('/')
			}.bind(this)).catch(function () {
				this.message = this.$t('erreurCommunicationServeur')
			}.bind(this))
		},
		afficherModaleModifierMotDePasse () {
			this.menu = ''
			this.modale = 'modifier-mot-de-passe'
			this.$nextTick(function () {
				document.querySelector('#champ-motdepasse-actuel').focus()
			})
		},
		modifierMotDePasse () {
			const motDePasse = this.motDePasse
			const nouveauMotDePasse = this.nouveauMotDePasse
			if (motDePasse !== '' && nouveauMotDePasse !== '') {
				this.modale = ''
				this.chargement = true
				axios.post(this.hote + '/api/modifier-mot-de-passe-mur', {
					mur: this.mur.id,
					identifiant: this.identifiant,
					motdepasse: motDePasse,
					nouveaumotdepasse: nouveauMotDePasse
				}).then(function (reponse) {
					const donnees = reponse.data
					if (donnees === 'non_connecte') {
						window.location.replace('/')
					} else if (donnees === 'motdepasse_incorrect') {
						this.chargement = false
						this.message = this.$t('motDePasseActuelPasCorrect')
					} else if (donnees === 'erreur') {
						this.chargement = false
						this.message = this.$t('erreurCommunicationServeur')
					} else {
						this.notification = this.$t('motDePasseModifie')
						this.fermerModaleModifierMotDePasse()
						this.chargement = false
					}
				}.bind(this)).catch(function () {
					this.chargement = false
					this.message = this.$t('erreurCommunicationServeur')
				}.bind(this))
			} else {
				this.message = this.$t('remplirChamps')
			}
		},
		fermerModaleModifierMotDePasse () {
			this.modale = ''
			this.motDePasse = ''
			this.nouveauMotDePasse = ''
		},
		afficherModaleMotDePasse () {
			this.modale = 'mot-de-passe'
			this.$nextTick(function () {
				document.querySelector('#champ-motdepasse').focus()
			})
		},
		verifierMotDePasse () {
			this.chargement = true
			axios.post(this.hote + '/api/verifier-mot-de-passe', {
				mur: this.mur.id,
				motdepasse: this.motDePasse
			}).then(function (reponse) {
				const donnees = reponse.data
				if (donnees === 'motdepasse_incorrect') {
					this.chargement = false
					this.message = this.$t('motDePassePasCorrect')
				} else if (donnees === 'erreur') {
					this.chargement = false
					this.message = this.$t('erreurCommunicationServeur')
				} else if (donnees === 'motdepasse_correct') {
					this.accesAutorise = true
					this.$socket.emit('debloquermur', this.mur.identifiant, this.mur.id)
					this.fermerModaleMotDePasse()
				} else if (donnees === 'motdepasseadmin_correct') {
					this.accesAutorise = true
					this.$socket.emit('debloquermur', this.identifiant, this.mur.id)
					this.fermerModaleMotDePasse()
				}
			}.bind(this)).catch(function () {
				this.chargement = false
				this.message = this.$t('erreurCommunicationServeur')
			}.bind(this))
		},
		fermerModaleMotDePasse () {
			this.motDePasse = ''
			this.modale = ''
		},
		afficherSeDeconnecterMur () {
			this.messageConfirmation = this.$t('confirmationSeDeconnecterMur')
			this.typeConfirmation = 'deconnecter-mur'
			this.modaleConfirmer = true
		},
		seDeconnecterMur () {
			this.modaleConfirmer = false
			this.chargement = true
			axios.post(this.hote + '/api/deconnecter-mur', {
				identifiant: this.identifiant
			}).then(function (reponse) {
				const donnees = reponse.data
				if (donnees === 'deconnecte') {
					window.location.reload()
				}
				this.chargement = false
			}.bind(this)).catch(function () {
				this.chargement = false
				this.message = this.$t('erreurCommunicationServeur')
			}.bind(this))
		},
		afficherExporterMur () {
			this.messageConfirmation = this.$t('confirmationExporterMur')
			this.typeConfirmation = 'exporter-mur'
			this.modaleConfirmer = true
		},
		exporterMur () {
			this.modaleConfirmer = false
			this.chargement = true
			axios.post(this.hote + '/api/exporter-mur', {
				murId: this.mur.id,
				identifiant: this.identifiant,
				admin: ''
			}).then(function (reponse) {
				const donnees = reponse.data
				if (donnees === 'erreur_export') {
					this.chargement = false
					this.message = this.$t('erreurExportMur')
				} else {
					saveAs('/temp/' + donnees, 'mur-' + this.mur.id + '.zip')
					this.chargement = false
				}
			}.bind(this)).catch(function () {
				this.chargement = false
				this.message = this.$t('erreurCommunicationServeur')
			}.bind(this))
		},
		modifierParametresImport (event, type) {
			if (type === 'contenu') {
				this.parametresImport[type] = event.target.value
			} else {
				this.parametresImport[type] = event.target.checked
			}
		},
		importerMur () {
			const champ = document.querySelector('#importer-mur')
			const extension = champ.files[0].name.substring(champ.files[0].name.lastIndexOf('.') + 1).toLowerCase()
			if (champ.files && champ.files[0] && extension === 'zip') {
				const formulaire = new FormData()
				formulaire.append('mur', this.mur.id)
				formulaire.append('parametres', JSON.stringify(this.parametresImport))
				formulaire.append('fichier', champ.files[0])
				axios.post(this.hote + '/api/importer-mur-sans-compte', formulaire, {
					headers: {
						'Content-Type': 'multipart/form-data'
					},
					onUploadProgress: function (progression) {
						const pourcentage = parseInt(Math.round((progression.loaded * 100) / progression.total))
						this.progressionImport = pourcentage
					}.bind(this)
				}).then(function (reponse) {
					this.fermerModaleImporterMur()
					const donnees = reponse.data
					if (donnees === 'non_connecte') {
						window.location.replace('/')
					} else if (donnees === 'erreur_import') {
						this.message = this.$t('erreurImportMur')
					} else if (donnees === 'donnees_corrompues') {
						this.message = this.$t('donneesCorrompuesImportMur')
					} else {
						this.$socket.emit('murimporte', this.identifiant)
						window.history.pushState({}, '', donnees)
						window.location.reload()
					}
				}.bind(this)).catch(function () {
					this.fermerModaleImporterMur()
					this.message = this.$t('erreurCommunicationServeur')
				}.bind(this))
			} else {
				this.message = this.$t('formatFichierPasAccepte')
				champ.value = ''
			}
		},
		fermerModaleImporterMur () {
			this.modale = ''
			this.parametresImport.contenu = 'ajouter'
			this.parametresImport.commentaires = false
			this.parametresImport.evaluations = false
			this.parametresImport.activite = false
			this.progressionImport = 0
			document.querySelector('#importer-mur').value = ''
		},
		afficherSupprimerMur () {
			this.messageConfirmation = this.$t('confirmationSupprimerMur')
			this.typeConfirmation = 'supprimer-mur'
			this.modaleConfirmer = true
		},
		supprimerMur () {
			this.modaleConfirmer = false
			this.chargement = true
			axios.post(this.hote + '/api/supprimer-mur', {
				murId: this.mur.id,
				type: 'mur',
				identifiant: this.identifiant,
				admin: ''
			}).then(function (reponse) {
				const donnees = reponse.data
				if (donnees === 'erreur_suppression') {
					this.chargement = false
					this.message = this.$t('erreurSuppressionMur')
				} else {
					window.location.replace('/')
				}
			}.bind(this)).catch(function () {
				this.chargement = false
				this.message = this.$t('erreurCommunicationServeur')
			}.bind(this))
		},
		envoyerNotificationAdmins () {
			if (this.identifiant !== this.mur.identifiant) {
				const adminsNonConnectes = []
				let notification = []
				if (this.mur.hasOwnProperty('notification')) {
					notification = this.mur.notification
				}
				if (!this.utilisateurs.map(function (e) { return e.identifiant }).includes(this.mur.identifiant) && !notification.includes(this.mur.identifiant)) {
					adminsNonConnectes.push(this.mur.identifiant)
				}
				this.mur.admins.forEach(function (admin) {
					if (!this.utilisateurs.map(function (e) { return e.identifiant }).includes(admin) && !notification.includes(admin)) {
						adminsNonConnectes.push(admin)
					}
				}.bind(this))
				if (adminsNonConnectes.length > 0) {
					this.$socket.emit('modifiernotification', this.mur.id, adminsNonConnectes)
				}
			}
		},
		definirLienFichier (id, media) {
			if (this.mode === 'creation' || (this.mode === 'edition' && this.donneesBloc.media !== media)) {
				return '/temp/' + media
			} else if (this.mode === 'edition' && this.donneesBloc.media === media) {
				return '/' + this.definirDossierFichiers(id) + '/' + id + '/' + media
			}
		},
		definirLienFichierExtra (id, mediaExtra) {
			if (this.mode === 'creation' || (this.mode === 'edition' && this.donneesBloc.mediaExtra !== mediaExtra)) {
				return '/temp/' + mediaExtra
			} else if (this.mode === 'edition' && this.donneesBloc.mediaExtra === mediaExtra) {
				return '/' + this.definirDossierFichiers(id) + '/' + id + '/' + mediaExtra
			}
		},
		definirLienFichierGalerie (id, media) {
			if (this.mode === 'creation' || (this.mode === 'edition' && !this.donneesBloc.medias.map(function (e) { return e.fichier }).includes(media))) {
				return '/temp/' + media
			} else if (this.mode === 'edition' && this.donneesBloc.medias.map(function (e) { return e.fichier }).includes(media)) {
				return '/' + this.definirDossierFichiers(id) + '/' + id + '/' + media
			}
		},
		definirLienVignette (id, vignette) {
			if (this.mode === 'creation' || (this.mode === 'edition' && this.donneesBloc.vignette !== '/' + this.definirDossierFichiers(id) + '/' + id + '/' + vignette)) {
				return '/temp/' + vignette
			} else if (this.mode === 'edition' && this.donneesBloc.vignette === '/' + this.definirDossierFichiers(id) + '/' + id + '/' + vignette) {
				return '/' + this.definirDossierFichiers(id) + '/' + id + '/' + vignette
			}
		},
		definirDossierFichiers (id) {
			if (import.meta.env.VITE_NFS_WALL_NUMBER && import.meta.env.VITE_NFS_WALL_NUMBER !== '' && import.meta.env.VITE_NFS_FOLDER && import.meta.env.VITE_NFS_FOLDER !== '' && parseInt(id) > parseInt(import.meta.env.VITE_NFS_WALL_NUMBER)) {
				return import.meta.env.VITE_NFS_FOLDER
			} else {
				return 'fichiers'
			}
		},
		quitterPage () {
			this.$socket.emit('sortie', this.mur.id, this.identifiant)
		},
		transcoder (aBuffer) {
			const numOfChan = aBuffer.numberOfChannels
			const btwLength = aBuffer.length * numOfChan * 2 + 44
			const btwArrBuff = new ArrayBuffer(btwLength)
			const btwView = new DataView(btwArrBuff)
			const btwChnls = []
			let btwIndex
			let btwSample
			let btwOffset = 0
			let btwPos = 0
			setUint32(0x46464952)
			setUint32(btwLength - 8)
			setUint32(0x45564157)
			// eslint-disable-next-line
			setUint32(0x20746d66)
			setUint32(16)
			setUint16(1)
			setUint16(numOfChan)
			setUint32(aBuffer.sampleRate)
			setUint32(aBuffer.sampleRate * 2 * numOfChan)
			setUint16(numOfChan * 2)
			setUint16(16)
			setUint32(0x61746164)
			setUint32(btwLength - btwPos - 4)
			for (btwIndex = 0; btwIndex < aBuffer.numberOfChannels; btwIndex++) {
				btwChnls.push(aBuffer.getChannelData(btwIndex))
			}
			while (btwPos < btwLength) {
				for (btwIndex = 0; btwIndex < numOfChan; btwIndex++) {
					btwSample = Math.max(-1, Math.min(1, btwChnls[btwIndex][btwOffset]))
					btwSample = (0.5 + btwSample < 0 ? btwSample * 32768 : btwSample * 32767) | 0
					btwView.setInt16(btwPos, btwSample, true)
					btwPos += 2
				}
				btwOffset++
			}
			const wavHdr = lamejs.WavHeader.readHeader(new DataView(btwArrBuff))
			const data = new Int16Array(btwArrBuff, wavHdr.dataOffset, wavHdr.dataLen / 2)
			const leftData = []
			const rightData = []
			for (let i = 0; i < data.length; i += 2) {
				leftData.push(data[i])
				rightData.push(data[i + 1])
			}
			const left = new Int16Array(leftData)
			const right = new Int16Array(rightData)
			let blob
			if (wavHdr.channels === 2) {
				blob = wavToMp3(wavHdr.channels, wavHdr.sampleRate, left, right)
			} else if (wavHdr.channels === 1) {
				blob = wavToMp3(wavHdr.channels, wavHdr.sampleRate, data)
			}
			return blob

			function setUint16 (data) {
				btwView.setUint16(btwPos, data, true)
				btwPos += 2
			}

			function setUint32 (data) {
				btwView.setUint32(btwPos, data, true)
				btwPos += 4
			}

			function wavToMp3 (channels, sampleRate, left, right = null) {
				const buffer = []
				const mp3enc = new lamejs.Mp3Encoder(channels, sampleRate, 96)
				let remaining = left.length
				const samplesPerFrame = 1152
				for (let i = 0; remaining >= samplesPerFrame; i += samplesPerFrame) {
					let mp3buf
					if (!right) {
						const mono = left.subarray(i, i + samplesPerFrame)
						mp3buf = mp3enc.encodeBuffer(mono)
					} else {
						const leftChunk = left.subarray(i, i + samplesPerFrame)
						const rightChunk = right.subarray(i, i + samplesPerFrame)
						mp3buf = mp3enc.encodeBuffer(leftChunk, rightChunk)
					}
					if (mp3buf.length > 0) {
						buffer.push(new Int8Array(mp3buf))
					}
					remaining -= samplesPerFrame
				}
				const d = mp3enc.flush()
				if (d.length > 0) {
					buffer.push(new Int8Array(d))
				}
				return new Blob(buffer, { type: 'audio/mpeg' })
			}
		},
		ecouterSocket () {
			this.$socket.on('connexion', function (donnees) {
				this.definirUtilisateurs(donnees)
			}.bind(this))

			this.$socket.on('deconnexion', function (identifiant) {
				const utilisateurs = this.utilisateurs
				utilisateurs.forEach(function (utilisateur, index) {
					if (utilisateur.identifiant === identifiant) {
						utilisateurs.splice(index, 1)
					}
				})
				this.utilisateurs = utilisateurs
			}.bind(this))

			this.$socket.on('erreur', function () {
				this.chargement = false
				this.message = this.$t('erreurActionServeur')
			}.bind(this))

			this.$socket.on('ajouterbloc', function (donnees) {
				this.action = 'ajouter'
				this.utilisateur = donnees.identifiant
				if (donnees.visibilite === 'visible' || this.admin || (this.mur.contributions === 'moderees' && (this.utilisateur === this.identifiant))) {
					if (this.mur.affichage === 'colonnes') {
						if (this.mur.ordre === 'croissant') {
							this.colonnes[donnees.colonne].push(donnees)
						} else {
							this.colonnes[donnees.colonne].unshift(donnees)
						}
					}
					if (this.mur.ordre === 'croissant') {
						this.blocs.push(donnees)
					} else {
						this.blocs.unshift(donnees)
					}
					if (donnees.visibilite === 'visible' || this.admin || (this.mur.contributions === 'moderees' && (this.utilisateur === this.identifiant))) {
						this.activite.unshift({ id: donnees.activiteId, bloc: donnees.bloc, identifiant: donnees.identifiant, nom: donnees.nom, titre: donnees.titre, date: donnees.date, type: 'bloc-ajoute' })
					}
					if (this.admin || this.mur.affichage !== 'colonnes' || (this.mur.affichage === 'colonnes' && this.affichageColonnes[donnees.colonne])) {
						this.$nextTick(function () {
							const bloc = document.querySelector('#' + donnees.bloc)
							bloc.classList.add('anime')
							bloc.addEventListener('animationend', function () {
								bloc.classList.remove('anime')
							})
						})
					}
					if (this.utilisateur === this.identifiant) {
						this.$nextTick(function () {
							const bloc = document.querySelector('#' + donnees.bloc)
							bloc.scrollIntoView()
						})
					}
					this.envoyerNotificationAdmins()
				}
			}.bind(this))

			this.$socket.on('copierbloc', function () {
				this.chargement = false
				this.notification = this.$t('capsuleCopiee')
			}.bind(this))

			this.$socket.on('modifierbloc', function (donnees) {
				this.action = 'modifier'
				if (this.mur.affichage === 'colonnes') {
					this.colonnes[donnees.colonne].forEach(function (item, index) {
						if (item.bloc === donnees.bloc) {
							if (donnees.visibilite === 'privee' && !this.admin) {
								this.colonnes[donnees.colonne].splice(index, 1)
							} else {
								this.colonnes[donnees.colonne].splice(index, 1, { bloc: donnees.bloc, typeBloc: donnees.typeBloc, identifiant: item.identifiant, nom: item.nom, titre: donnees.titre, texte: donnees.texte, media: donnees.media, iframe: donnees.iframe, type: donnees.type, source: donnees.source, vignette: donnees.vignette, vignetteActivite: donnees.vignetteActivee, mediaExtra: donnees.mediaExtra, medias: donnees.medias, edition: donnees.edition, date: item.date, modifie: donnees.modifie, couleur: donnees.couleur, commentaires: item.commentaires, evaluations: item.evaluations, colonne: item.colonne, visibilite: donnees.visibilite, motdepasse: donnees.motdepasse })
							}
						}
					}.bind(this))
				}
				this.blocs.forEach(function (item, index) {
					if (item.bloc === donnees.bloc) {
						this.utilisateur = donnees.identifiant
						if (donnees.visibilite === 'privee' && !this.admin) {
							this.blocs.splice(index, 1)
						} else {
							this.blocs.splice(index, 1, { bloc: donnees.bloc, typeBloc: donnees.typeBloc, identifiant: item.identifiant, nom: item.nom, titre: donnees.titre, texte: donnees.texte, media: donnees.media, iframe: donnees.iframe, type: donnees.type, source: donnees.source, vignette: donnees.vignette, vignetteActivee: donnees.vignetteActivee, mediaExtra: donnees.mediaExtra, medias: donnees.medias, edition: donnees.edition, date: item.date, modifie: donnees.modifie, couleur: donnees.couleur, commentaires: item.commentaires, evaluations: item.evaluations, colonne: item.colonne, visibilite: donnees.visibilite, motdepasse: donnees.motdepasse })
						}
					}
				}.bind(this))
				if (donnees.visibilite === 'visible' || donnees.visibilite === 'protegee') {
					this.activite.unshift({ id: donnees.activiteId, bloc: donnees.bloc, identifiant: donnees.identifiant, nom: donnees.nom, titre: donnees.titre, date: donnees.modifie, type: 'bloc-modifie' })
				}
				this.envoyerNotificationAdmins()
			}.bind(this))

			this.$socket.on('autoriserbloc', function (donnees) {
				if ((this.mur.contributions === 'moderees' && (donnees.identifiant === this.identifiant)) || this.admin) {
					if (this.mur.affichage === 'colonnes') {
						this.colonnes.forEach(function (colonne, indexColonne) {
							colonne.forEach(function (item, index) {
								if (item.bloc === donnees.bloc) {
									this.colonnes[indexColonne][index].visibilite = 'visible'
									this.colonnes[indexColonne][index].date = donnees.date
									if (this.colonnes[indexColonne][index].hasOwnProperty('modifie')) {
										delete this.colonnes[indexColonne][index].modifie
									}
								}
							}.bind(this))
						}.bind(this))
					}
					this.blocs.forEach(function (item, index) {
						if (item.bloc === donnees.bloc) {
							this.blocs[index].visibilite = 'visible'
							this.blocs[index].date = donnees.date
							if (this.blocs[index].hasOwnProperty('modifie')) {
								delete this.blocs[index].modifie
							}
						}
					}.bind(this))
					this.chargement = false
				} else {
					this.blocs.splice(donnees.indexBloc, 0, donnees)
					if (this.mur.affichage === 'colonnes') {
						this.colonnes[donnees.colonne].splice(donnees.indexBlocColonne, 0, donnees)
					}
				}
				this.activite.unshift({ id: donnees.activiteId, bloc: donnees.bloc, identifiant: donnees.identifiant, nom: donnees.nom, titre: donnees.titre, date: donnees.date, type: 'bloc-ajoute' })
				this.$nextTick(function () {
					const bloc = document.querySelector('#' + donnees.bloc)
					if (bloc !== null) {
						bloc.classList.add('anime')
						bloc.addEventListener('animationend', function () {
							bloc.classList.remove('anime')
						})
					}
				})
				if (this.admin && this.identifiant === donnees.admin && donnees.moderation === 'moderee') {
					this.notification = this.$t('capsuleValidee')
				} else if (this.admin && this.identifiant === donnees.admin && donnees.moderation === 'privee') {
					this.notification = this.$t('capsuleVisible')
				} else if (!this.admin && donnees.identifiant === this.identifiant) {
					this.notification = this.$t('capsulePubliee', { titre: donnees.titre })
				}
				if (this.modale === 'diaporama') {
					this.$nextTick(function () {
						this.chargerDiapositive()
					}.bind(this))
				}
			}.bind(this))

			this.$socket.on('verrouillerbloc', function (donnees) {
				this.chargement = false
				if (this.mur.affichage === 'colonnes') {
					this.colonnes[donnees.colonne].forEach(function (item, index) {
						if (item.bloc === donnees.bloc) {
							this.colonnes[donnees.colonne][index].edition = 'non'
						}
					}.bind(this))
				}
				this.blocs.forEach(function (item, index) {
					if (item.bloc === donnees.bloc) {
						this.blocs[index].edition = 'non'
					}
				}.bind(this))
				if (this.admin && this.identifiant === donnees.identifiant) {
					this.notification = this.$t('capsuleVerrouillee')
				}
			}.bind(this))

			this.$socket.on('deverrouillerbloc', function (donnees) {
				this.chargement = false
				if (this.mur.affichage === 'colonnes') {
					this.colonnes[donnees.colonne].forEach(function (item, index) {
						if (item.bloc === donnees.bloc) {
							this.colonnes[donnees.colonne][index].edition = 'oui'
						}
					}.bind(this))
				}
				this.blocs.forEach(function (item, index) {
					if (item.bloc === donnees.bloc) {
						this.blocs[index].edition = 'oui'
					}
				}.bind(this))
				if (this.admin && this.identifiant === donnees.identifiant) {
					this.notification = this.$t('capsuleDeverrouillee')
				}
			}.bind(this))

			this.$socket.on('deplacerbloc', function (donnees) {
				this.utilisateur = donnees.identifiant
				const blocActif = document.querySelector('.bloc.actif')
				let blocId = ''
				if (blocActif && this.utilisateur !== this.identifiant) {
					blocId = blocActif.id
				}
				if (this.admin && this.mur.affichage === 'colonnes') {
					this.definirColonnes(donnees.blocs)
				} else if (this.admin && this.mur.affichage !== 'colonnes') {
					this.blocs = donnees.blocs
				} else if (!this.admin) {
					let blocs
					if (this.mur.contributions === 'moderees') {
						blocs = donnees.blocs.filter(function (element) {
							return element.visibilite === 'visible' || (element.visibilite === 'masquee' && element.identifiant === this.identifiant)
						}.bind(this))
					} else {
						blocs = donnees.blocs.filter(function (element) {
							return element.visibilite !== 'privee'
						})
					}
					if (this.mur.affichage === 'colonnes') {
						this.definirColonnes(blocs)
					} else {
						this.blocs = blocs
					}
				}
				this.$nextTick(function () {
					if (blocActif && this.utilisateur !== this.identifiant && document.querySelector('#' + blocId)) {
						blocActif.classList.remove('actif')
						document.querySelector('#' + blocId).classList.add('actif')
					}
				}.bind(this))
				this.chargement = false
			}.bind(this))

			this.$socket.on('supprimerbloc', function (donnees) {
				this.action = 'supprimer'
				if (this.mur.affichage === 'colonnes') {
					this.colonnes[donnees.colonne].forEach(function (item, index) {
						if (item.bloc === donnees.bloc) {
							this.colonnes[donnees.colonne].splice(index, 1)
						}
					}.bind(this))
				}
				this.blocs.forEach(function (item, index) {
					if (item.bloc === donnees.bloc) {
						this.utilisateur = donnees.identifiant
						this.blocs.splice(index, 1)
					}
				}.bind(this))
				this.activite.unshift({ id: donnees.activiteId, bloc: donnees.bloc, identifiant: donnees.identifiant, nom: donnees.nom, titre: donnees.titre, date: donnees.date, type: 'bloc-supprime' })
				this.envoyerNotificationAdmins()
				if (this.identifiant === donnees.identifiant && donnees.etherpad !== '') {
					const etherpadId = donnees.etherpad.replace(this.etherpad + '/p/', '')
					const url = this.etherpad + '/api/1/deletePad?apikey=' + this.etherpadApi + '&padID=' + etherpadId
					axios.get(url)
				}
			}.bind(this))

			this.$socket.on('commenterbloc', function (donnees) {
				const blocs = this.blocs
				blocs.forEach(function (item) {
					if (item.bloc === donnees.bloc) {
						item.commentaires = donnees.commentaires
					}
				})
				this.blocs = blocs
				if ((this.modale === 'commentaires' && this.bloc === donnees.bloc) || (this.modale === 'diaporama' && this.donneesBloc.bloc === donnees.bloc)) {
					this.commentaires.unshift({ id: donnees.id, identifiant: donnees.identifiant, nom: donnees.nom, texte: donnees.texte, date: donnees.date })
				}
				this.activite.unshift({ id: donnees.activiteId, bloc: donnees.bloc, identifiant: donnees.identifiant, nom: donnees.nom, titre: donnees.titre, date: donnees.date, type: 'bloc-commente' })
				this.envoyerNotificationAdmins()
			}.bind(this))

			this.$socket.on('modifiercommentaire', function (donnees) {
				const commentaires = this.commentaires
				commentaires.forEach(function (commentaire) {
					if (commentaire.id === donnees.id) {
						commentaire.texte = donnees.texte
					}
				})
				this.commentaires = commentaires
			}.bind(this))

			this.$socket.on('supprimercommentaire', function (donnees) {
				const blocs = this.blocs
				blocs.forEach(function (item) {
					if (item.bloc === donnees.bloc) {
						item.commentaires = donnees.commentaires
					}
				})
				this.blocs = blocs
				const commentaires = this.commentaires
				commentaires.forEach(function (commentaire, index) {
					if (commentaire.id === donnees.id) {
						commentaires.splice(index, 1)
					}
				})
				this.commentaires = commentaires
			}.bind(this))

			this.$socket.on('commentaires', function (donnees) {
				this.commentaires = donnees.commentaires
				if (donnees.type === 'discussion') {
					this.chargement = false
					this.modale = 'commentaires'
					this.$nextTick(function () {
						this.genererEditeur()
					}.bind(this))
				} else {
					this.chargerDiapositive()
				}
			}.bind(this))

			this.$socket.on('evaluerbloc', function (donnees) {
				this.chargement = false
				const blocs = this.blocs
				blocs.forEach(function (item) {
					if (item.bloc === donnees.bloc) {
						item.evaluations.push(donnees.evaluation)
					}
				})
				this.blocs = blocs
				this.activite.unshift({ id: donnees.activiteId, bloc: donnees.bloc, identifiant: donnees.identifiant, nom: donnees.nom, titre: donnees.titre, date: donnees.date, type: 'bloc-evalue' })
				this.envoyerNotificationAdmins()
			}.bind(this))

			this.$socket.on('modifierevaluation', function (donnees) {
				this.chargement = false
				const blocs = this.blocs
				blocs.forEach(function (item, index) {
					if (item.bloc === donnees.bloc) {
						const evaluations = item.evaluations
						evaluations.forEach(function (evaluation) {
							if (evaluation.id === donnees.id) {
								evaluation.date = donnees.date
								evaluation.etoiles = donnees.etoiles
							}
						})
					}
				})
				this.blocs = blocs
			}.bind(this))

			this.$socket.on('supprimerevaluation', function (donnees) {
				this.chargement = false
				const blocs = this.blocs
				blocs.forEach(function (item) {
					if (item.bloc === donnees.bloc) {
						const evaluations = item.evaluations
						evaluations.forEach(function (evaluation, index) {
							if (evaluation.id === donnees.id) {
								evaluations.splice(index, 1)
							}
						})
					}
				})
				this.blocs = blocs
			}.bind(this))

			this.$socket.on('modifiernom', function (donnees) {
				this.modifierCaracteristique(donnees.identifiant, 'nom', donnees.nom)
				this.chargement = false
				if (donnees.identifiant === this.identifiant) {
					this.nom = donnees.nom
					this.notification = this.$t('nomModifie')
				}
			}.bind(this))

			this.$socket.on('modifiertitre', function (donnees) {
				this.mur.titre = donnees.titre
				this.mur.slug = donnees.slug
				this.pressePapierLien.destroy()
				this.pressePapierIframe.destroy()
				this.$nextTick(function () {
					this.chargement = false
					this.definirPressePapier()
					document.title = this.mur.titre + ' - Digiwall by La Digitale'
					window.history.pushState({}, '', donnees.slug)
					if (this.admin && this.identifiant === donnees.identifiant) {
						this.notification = this.$t('titreMurModifie')
					}
				}.bind(this))
			}.bind(this))

			this.$socket.on('modifiercodeacces', function (code, identifiant) {
				this.mur.code = code
				this.chargement = false
				this.modificationCode = false
				if (this.admin && this.identifiant === identifiant) {
					this.notification = this.$t('codeAccesModifie')
				}
			}.bind(this))

			this.$socket.on('modifieradmins', function (admins, motdepasseAdmin, identifiant) {
				this.mur.admins = admins
				this.mur.motdepasseAdmin = motdepasseAdmin
				this.chargement = false
				if (this.admin && this.identifiant === identifiant) {
					this.notification = this.$t('accesAdminsModifie')
				}
			}.bind(this))

			this.$socket.on('motsdepasseidentiques', function () {
				this.chargement = false
				this.message = this.$t('attentionMotsDePasse')
			}.bind(this))

			this.$socket.on('modifieracces', function (donnees) {
				this.mur.acces = donnees.acces
				this.chargement = false
				if (this.admin) {
					if (donnees.acces === 'code') {
						this.mur.code = donnees.code
						this.codeVisible = true
					}
					this.notification = this.$t('accesMurModifie')
				} else {
					if (donnees.acces === 'prive') {
						this.$socket.emit('sortie', this.mur.id, this.identifiant)
						window.location.replace('/')
					}
				}
			}.bind(this))

			this.$socket.on('modifiercontributions', function (donnees) {
				this.mur.contributions = donnees.contributions
				this.chargement = false
				if (this.admin) {
					this.notification = this.$t('statutMurModifie')
				}
				if (!this.admin && donnees.contributionsPrecedentes === 'moderees') {
					this.notification = this.$t('rechargerPage')
				}
			}.bind(this))

			this.$socket.on('modifieraffichage', function (affichage, identifiant) {
				this.mur.affichage = affichage
				this.affichage = affichage
				this.chargement = false
				if (this.admin && this.identifiant === identifiant) {
					this.action = ''
					this.notification = this.$t('affichageMurModifie')
				}
			}.bind(this))

			this.$socket.on('modifierordre', function (ordre, identifiant) {
				const blocActif = document.querySelector('.bloc.actif')
				let blocId = ''
				if (blocActif) {
					blocId = blocActif.id
				}
				this.mur.ordre = ordre
				this.blocs.reverse()
				if (this.mur.affichage === 'colonnes') {
					this.definirColonnes(this.blocs)
				}
				this.$nextTick(function () {
					if (blocActif) {
						blocActif.classList.remove('actif')
						document.querySelector('#' + blocId).classList.add('actif')
					}
				})
				this.chargement = false
				if (this.admin && this.identifiant === identifiant) {
					this.notification = this.$t('parametreOrdreModifie')
				}
			}.bind(this))

			this.$socket.on('modifierlargeur', function (largeur, identifiant) {
				this.mur.largeur = largeur
				if (this.mur.affichage === 'mur') {
					this.mur.affichage = ''
					setTimeout(function () {
						this.mur.affichage = 'mur'
					}.bind(this), 10)
				}
				this.chargement = false
				if (this.admin && this.identifiant === identifiant) {
					this.notification = this.$t('parametreLargeurModifie')
				}
			}.bind(this))

			this.$socket.on('modifierfond', function (fond, identifiant) {
				this.mur.fond = fond
				imagesLoaded('#mur', { background: true }, function () {
					this.chargement = false
					if (this.admin && this.identifiant === identifiant) {
						this.notification = this.$t('arrierePlanModifie')
					}
				}.bind(this))
			}.bind(this))

			this.$socket.on('modifiercouleurfond', function (fond, identifiant) {
				this.mur.fond = fond
				this.chargement = false
				if (this.admin && this.identifiant === identifiant) {
					this.notification = this.$t('arrierePlanModifie')
				}
			}.bind(this))

			this.$socket.on('modifieractivite', function (statut, identifiant) {
				this.mur.registreActivite = statut
				this.chargement = false
				if (this.admin && this.identifiant === identifiant) {
					this.notification = this.$t('parametreActiviteModifie')
				}
			}.bind(this))

			this.$socket.on('modifierconversation', function (statut, identifiant) {
				this.mur.conversation = statut
				this.chargement = false
				if (this.admin && this.identifiant === identifiant) {
					this.notification = this.$t('parametreConversationModifie')
				}
			}.bind(this))

			this.$socket.on('modifierlisteutilisateurs', function (statut, identifiant) {
				if (statut === 'desactivee') {
					this.menu = ''
				}
				this.mur.listeUtilisateurs = statut
				this.chargement = false
				if (this.admin && this.identifiant === identifiant) {
					this.notification = this.$t('parametreListeUtilisateursModifie')
				}
			}.bind(this))

			this.$socket.on('modifiereditionnom', function (statut, identifiant) {
				this.mur.editionNom = statut
				this.chargement = false
				if (this.admin && this.identifiant === identifiant) {
					this.notification = this.$t('parametreEditionNomModifie')
				}
			}.bind(this))

			this.$socket.on('modifierfichiers', function (statut, identifiant) {
				this.mur.fichiers = statut
				this.chargement = false
				if (this.admin && this.identifiant === identifiant) {
					this.notification = this.$t('parametreFichiersModifie')
				}
			}.bind(this))

			this.$socket.on('modifierenregistrements', function (statut, identifiant) {
				this.mur.enregistrements = statut
				this.chargement = false
				if (this.admin && this.identifiant === identifiant) {
					this.notification = this.$t('parametreEnregistrementsModifie')
				}
			}.bind(this))

			this.$socket.on('modifierliens', function (statut, identifiant) {
				this.mur.liens = statut
				this.chargement = false
				if (this.admin && this.identifiant === identifiant) {
					this.notification = this.$t('parametreLiensModifie')
				}
			}.bind(this))

			this.$socket.on('modifierdocuments', function (statut, identifiant) {
				this.mur.documents = statut
				this.chargement = false
				if (this.admin && this.identifiant === identifiant) {
					this.notification = this.$t('parametreDocumentsModifie')
				}
			}.bind(this))

			this.$socket.on('modifiercommentaires', function (statut, identifiant) {
				this.mur.commentaires = statut
				this.chargement = false
				if (this.admin && this.identifiant === identifiant) {
					this.notification = this.$t('parametreCommentairesModifie')
				}
			}.bind(this))

			this.$socket.on('modifierevaluations', function (statut, identifiant) {
				this.mur.evaluations = statut
				this.chargement = false
				if (this.admin && this.identifiant === identifiant) {
					this.notification = this.$t('parametreEvaluationModifie')
				}
			}.bind(this))

			this.$socket.on('modifierverrouillage', function (statut, identifiant) {
				this.mur.verrouillage = statut
				this.chargement = false
				if (this.admin && this.identifiant === identifiant) {
					this.notification = this.$t('parametreVerrouillageModifie')
				}
			}.bind(this))

			this.$socket.on('modifiercopiebloc', function (statut, identifiant) {
				this.mur.copieBloc = statut
				this.chargement = false
				if (this.admin && this.identifiant === identifiant) {
					this.notification = this.$t('parametreCopieBlocModifie')
				}
			}.bind(this))

			this.$socket.on('murimporte', function () {
				this.notification = this.$t('rechargerPage')
			}.bind(this))

			this.$socket.on('messagechat', function (message) {
				message.texte = linkifyHtml(message.texte, {
					defaultProtocol: 'https',
					target: '_blank'
				})
				this.messagesChat.push(message)
				if (message.identifiant !== this.identifiant && this.menu !== 'chat') {
					this.nouveauxMessagesChat++
				}
			}.bind(this))

			this.$socket.on('reinitialisermessages', function (identifiant) {
				this.messagesChat = []
				this.nouveauxMessagesChat = 0
				this.chargement = false
				if (this.admin && this.identifiant === identifiant) {
					this.notification = this.$t('historiqueConversationSupprime')
				}
			}.bind(this))

			this.$socket.on('reinitialiseractivite', function (identifiant) {
				this.activite = []
				this.chargement = false
				if (this.admin && this.identifiant === identifiant) {
					this.notification = this.$t('activiteSupprimee')
				}
			}.bind(this))

			this.$socket.on('supprimeractivite', function (id, identifiant) {
				this.activite.forEach(function (activite, index) {
					if (activite.id === id) {
						this.activite.splice(index, 1)
					}
				}.bind(this))
				this.chargement = false
				if (this.admin && this.identifiant === identifiant) {
					this.notification = this.$t('entreeActiviteSupprimee')
				}
			}.bind(this))

			this.$socket.on('ajoutercolonne', function (donnees) {
				this.colonnes.push([])
				this.affichageColonnes.push(true)
				this.mur.colonnes = donnees.colonnes
				this.mur.affichageColonnes = donnees.affichageColonnes
				this.activite.unshift({ id: donnees.activiteId, identifiant: donnees.identifiant, nom: donnees.nom, titre: donnees.titre, date: donnees.date, type: 'colonne-ajoutee' })
				if (this.admin && this.identifiant === donnees.identifiant) {
					this.notification = this.$t('colonneAjoutee')
				}
				this.chargement = false
			}.bind(this))

			this.$socket.on('modifiertitrecolonne', function (colonnes, identifiant) {
				this.mur.colonnes = colonnes
				if (this.admin && this.identifiant === identifiant) {
					this.notification = this.$t('nomColonneModifie')
				}
				this.chargement = false
			}.bind(this))

			this.$socket.on('modifieraffichagecolonne', function (affichageColonnes, identifiant) {
				this.mur.affichageColonnes = affichageColonnes
				if (this.admin && this.identifiant === identifiant) {
					this.notification = this.$t('affichageColonneModifie')
				}
				this.chargement = false
			}.bind(this))

			this.$socket.on('supprimercolonne', function (donnees) {
				this.colonnes.splice(parseInt(donnees.colonne), 1)
				const blocs = []
				this.colonnes.forEach(function (colonne, index) {
					colonne.forEach(function (bloc) {
						bloc.colonne = index
					})
					blocs.push(...colonne)
				})
				this.mur.colonnes = donnees.colonnes
				this.mur.affichageColonnes = donnees.affichageColonnes
				this.blocs = blocs
				this.activite.unshift({ id: donnees.activiteId, identifiant: donnees.identifiant, nom: donnees.nom, titre: donnees.titre, date: donnees.date, type: 'colonne-supprimee' })
				if (this.admin && this.identifiant === donnees.identifiant) {
					this.notification = this.$t('colonneSupprimee')
				} else if (!this.admin && this.modale === 'bloc' && parseInt(this.colonne) === parseInt(donnees.colonne)) {
					this.fermerModaleBloc()
					this.notification = this.$t('colonneActuelleSupprimee')
				}
				this.chargement = false
			}.bind(this))

			this.$socket.on('deplacercolonne', function (donnees) {
				const blocs = []
				const donneesColonnes = this.colonnes[parseInt(donnees.colonne)]
				const donneesAffichageColonnes = this.affichageColonnes[parseInt(donnees.colonne)]
				if (donnees.direction === 'gauche') {
					this.colonnes.splice((parseInt(donnees.colonne) - 1), 0, donneesColonnes)
					this.colonnes.splice((parseInt(donnees.colonne) + 1), 1)
					this.affichageColonnes.splice((parseInt(donnees.colonne) - 1), 0, donneesAffichageColonnes)
					this.affichageColonnes.splice((parseInt(donnees.colonne) + 1), 1)
				} else if (donnees.direction === 'droite') {
					const donneesColonneDeplacee = this.colonnes[parseInt(donnees.colonne) + 1]
					this.colonnes.splice((parseInt(donnees.colonne) + 1), 0, donneesColonnes)
					this.colonnes.splice(parseInt(donnees.colonne), 1, donneesColonneDeplacee)
					this.colonnes.splice((parseInt(donnees.colonne) + 2), 1)
					const donneesAffichageColonneDeplacee = this.affichageColonnes[parseInt(donnees.colonne) + 1]
					this.affichageColonnes.splice((parseInt(donnees.colonne) + 1), 0, donneesAffichageColonnes)
					this.affichageColonnes.splice(parseInt(donnees.colonne), 1, donneesAffichageColonneDeplacee)
					this.affichageColonnes.splice((parseInt(donnees.colonne) + 2), 1)
				}
				this.colonnes.forEach(function (colonne, index) {
					colonne.forEach(function (bloc) {
						bloc.colonne = index
					})
					blocs.push(...colonne)
				})
				this.mur.colonnes = donnees.colonnes
				this.mur.affichageColonnes = donnees.affichageColonnes
				this.blocs = blocs
				this.activite.unshift({ id: donnees.activiteId, identifiant: donnees.identifiant, nom: donnees.nom, titre: donnees.titre, date: donnees.date, type: 'colonne-deplacee' })
				if (this.admin && this.identifiant === donnees.identifiant) {
					this.notification = this.$t('colonneDeplacee')
				} else {
					if (this.modale === 'bloc' && parseInt(this.colonne) === parseInt(donnees.colonne) && donnees.direction === 'gauche') {
						this.colonne = parseInt(donnees.colonne) - 1
					} else if (this.modale === 'bloc' && parseInt(this.colonne) === parseInt(donnees.colonne) && donnees.direction === 'droite') {
						this.colonne = parseInt(donnees.colonne) + 1
					} else if (this.modale === 'bloc' && parseInt(this.colonne) === (parseInt(donnees.colonne) - 1) && donnees.direction === 'gauche') {
						this.colonne = parseInt(donnees.colonne)
					} else if (this.modale === 'bloc' && parseInt(this.colonne) === (parseInt(donnees.colonne) + 1) && donnees.direction === 'droite') {
						this.colonne = parseInt(donnees.colonne)
					}
				}
				this.chargement = false
			}.bind(this))

			this.$socket.on('debloquermur', function (donnees) {
				this.chargement = false
				this.modifierCaracteristique(this.identifiant, 'identifiant', donnees.identifiant)
				this.modifierCaracteristique(donnees.identifiant, 'nom', donnees.nom)
				const murs = JSON.parse(JSON.stringify(this.murs))
				if (!murs.includes(this.mur.id)) {
					murs.push(this.mur.id)
				}
				this.identifiant = donnees.identifiant
				this.nom = donnees.nom
				this.langue = donnees.langue
				this.statut = 'auteur'
				this.murs = murs
				this.notification = this.$t('murDebloque')
			}.bind(this))

			this.$socket.on('modifiernotification', function (donnees) {
				this.mur.notification = donnees
			}.bind(this))

			this.$socket.on('verifiermodifierbloc', function (donnees) {
				if (this.modale === 'bloc' && this.bloc === donnees.bloc) {
					this.$socket.emit('reponsemodifierbloc', this.mur.id, donnees.identifiant, true)
				} else {
					this.$socket.emit('reponsemodifierbloc', this.mur.id, donnees.identifiant, false)
				}
			}.bind(this))

			this.$socket.on('reponsemodifierbloc', function (donnees) {
				if (this.identifiant === donnees.identifiant && donnees.reponse === true) {
					this.notification = this.$t('capsuleEnCoursModification')
				}
			}.bind(this))

			this.$socket.on('deconnecte', function () {
				this.chargement = false
				this.notification = this.$t('problemeConnexion')
			}.bind(this))

			this.$socket.on('maintenance', function () {
				window.location.href = '/maintenance'
			})
		}
	}
}
