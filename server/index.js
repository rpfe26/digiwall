require('dotenv').config()
const path = require('path')
const fs = require('fs-extra')
const express = require('express')
const { createServer } = require('http')
const { Server } = require('socket.io')
const session = require('express-session')
const axios = require('axios')
const cors = require('cors')
const redis = require('redis')
const bodyParser = require('body-parser')
const helmet = require('helmet')
const v = require('voca')
const multer = require('multer')
const sharp = require('sharp')
const gm = require('gm')
const archiver = require('archiver')
const extract = require('extract-zip')
const dayjs = require('dayjs')
require('dayjs/locale/fr')
require('dayjs/locale/es')
require('dayjs/locale/it')
require('dayjs/locale/hr')
const localizedFormat = require('dayjs/plugin/localizedFormat')
const bcrypt = require('bcrypt')
const cron = require('node-cron')
const nodemailer = require('nodemailer')
const { URL } = require('url')
const cheerio = require('cheerio')
const libre = require('libreoffice-convert')
libre.convertAsync = require('util').promisify(libre.convert)
const { renderPage } = require('vite-plugin-ssr/server')

const production = process.env.NODE_ENV === 'production'
const root = `${__dirname}/..`

demarrerServeur()

async function demarrerServeur () {
	const app = express()
	const httpServer = createServer(app)
	const RedisStore = require('connect-redis')(session)

	let hote = 'http://localhost:3000'
	if (process.env.PORT) {
		hote = 'http://localhost:' + process.env.PORT
	}
	if (production) {
		hote = process.env.DOMAIN
	}
	let db
	let db_port = 6379
	if (process.env.DB_PORT) {
		db_port = process.env.DB_PORT
	}
	if (production) {
		db = redis.createClient({ host: process.env.DB_HOST, port: db_port, password: process.env.DB_PWD })
	} else {
		db = redis.createClient({ port: db_port })
	}
	let storeOptions, cookie, dureeSession, dateCron
	let maintenance = false
	if (production) {
		storeOptions = {
			host: process.env.DB_HOST,
			port: db_port,
			pass: process.env.DB_PWD,
			client: db,
			prefix: 'sessions:'
		}
		cookie = {
			sameSite: 'None',
			secure: true
		}
	} else {
		storeOptions = {
			host: 'localhost',
			port: db_port,
			client: db,
			prefix: 'sessions:'
		}
		cookie = {
			secure: false
		}
	}
	const sessionOptions = {
		secret: process.env.SESSION_KEY,
		store: new RedisStore(storeOptions),
		name: 'digiwall',
		resave: false,
		rolling: true,
		saveUninitialized: false,
		cookie: cookie
	}
	if (process.env.SESSION_DURATION) {
		dureeSession = parseInt(process.env.SESSION_DURATION)
	} else {
		dureeSession = 864000000 //3600 * 24 * 10 * 1000
	}
	const sessionMiddleware = session(sessionOptions)

	if (production && process.env.AUTORIZED_DOMAINS) {
		domainesAutorises = process.env.AUTORIZED_DOMAINS.split(',')
	} else {
		domainesAutorises = '*'
	}

	const transporter = nodemailer.createTransport({
		host: process.env.EMAIL_HOST,
		port: process.env.EMAIL_PORT,
		secure: process.env.EMAIL_SECURE,
		auth: {
			user: process.env.EMAIL_ADDRESS,
			pass: process.env.EMAIL_PASSWORD
		}
	})

	if (process.env.CRON_TASK_DATE) {
		dateCron = process.env.CRON_TASK_DATE
	} else {
		dateCron = '59 23 * * Saturday' // tous les samedis à 23h59
	}
	cron.schedule(dateCron, async function () {
		await fs.emptyDir(path.join(__dirname, '..', '/static/temp'))
	})

	// Charger plugin dayjs
	dayjs.extend(localizedFormat)

	const etherpad = process.env.VITE_ETHERPAD
	const etherpadApi = process.env.VITE_ETHERPAD_API_KEY

	// Augmenter nombre de tâches asynchrones par défaut
	require('events').EventEmitter.defaultMaxListeners = 50

	app.set('trust proxy', true)
	app.use(
		helmet.contentSecurityPolicy({
			directives: {
				"default-src": ["'self'", "https:", "ws:"],
				"script-src": ["'self'", process.env.VITE_MATOMO, "'unsafe-inline'", "'unsafe-eval'"],
				"media-src": ["'self'", "data:", "blob:"],
				"img-src": ["'self'", "https:", "data:"],
				"frame-ancestors": ["*"],
				"frame-src": ["*", "blob:"]
			}
		})
	)
	app.use(bodyParser.json({ limit: '500mb' }))
	app.use(sessionMiddleware)
	app.use(cors({ 'origin': domainesAutorises }))
	app.use('/', express.static('static'))

	if (production) {
		app.use(express.static('dist/client'))
	} else {
    	const vite = require('vite')
    	const viteDevMiddleware = (
      		await vite.createServer({
        		root,
        		server: { middlewareMode: true }
			})
    	).middlewares
    	app.use(viteDevMiddleware)
  	}
	
	app.get('/', async function (req, res, next) {
		if (maintenance === true) {
			res.redirect('/maintenance')
		} else if (req.session.identifiant && req.session.statut === 'utilisateur') {
			res.redirect('/u/' + req.session.identifiant)
		} else {
			let langue = 'fr'
			if (req.session.hasOwnProperty('langue') && req.session.langue !== '') {
				langue = req.session.langue
			}
			const pageContextInit = {
				urlOriginal: req.originalUrl,
				params: req.query,
				hote: hote,
				langues: ['fr', 'es', 'it', 'hr', 'en'],
				langue: langue
			}
			const pageContext = await renderPage(pageContextInit)
			const { httpResponse } = pageContext
			if (!httpResponse) {
				return next()
			}
			const { body, statusCode, contentType, earlyHints } = httpResponse
			if (res.writeEarlyHints) {
				res.writeEarlyHints({ link: earlyHints.map((e) => e.earlyHintLink) })
			}
			res.status(statusCode).type(contentType).send(body)
		}
  	})
	
	app.get('/u/:utilisateur', async function (req, res, next) {
		const identifiant = req.params.utilisateur
		if (maintenance === true) {
			res.redirect('/maintenance')
		} else if (identifiant === req.session.identifiant && req.session.statut === 'utilisateur') {
			const pageContextInit = {
				urlOriginal: req.originalUrl,
				params: req.query,
				hote: hote,
				langues: ['fr', 'es', 'it', 'hr', 'en'],
				identifiant: req.session.identifiant,
				nom: req.session.nom,
				email: req.session.email,
				langue: req.session.langue,
				statut: req.session.statut
			}
			const pageContext = await renderPage(pageContextInit)
			const { httpResponse } = pageContext
			if (!httpResponse) return next()
			const { body, statusCode, contentType, earlyHints } = httpResponse
			if (res.writeEarlyHints) res.writeEarlyHints({ link: earlyHints.map((e) => e.earlyHintLink) })
			res.status(statusCode).type(contentType).send(body)
		} else {
			res.redirect('/')
		}
  	})
	
	app.get('/w/:id/:token/:slug', async function (req, res, next) {
		if (maintenance === true) {
			res.redirect('/maintenance')
			return false
		}
		const userAgent = req.headers['user-agent']
		if (req.session.identifiant === '' || req.session.identifiant === undefined) {
			const identifiant = 'u' + Math.random().toString(16).slice(3)
			req.session.identifiant = identifiant
			req.session.nom = identifiant.slice(0, 8).toUpperCase()
			req.session.email = ''
			req.session.langue = 'fr'
			req.session.statut = 'invite'
			req.session.acces = []
			req.session.murs = []
			req.session.digidrive = []
			req.session.cookie.expires = new Date(Date.now() + dureeSession)
		}	
		const pageContextInit = {
			urlOriginal: req.originalUrl,
			params: req.query,
			hote: hote,
			userAgent: userAgent,
			langues: ['fr', 'es', 'it', 'hr', 'en'],
			identifiant: req.session.identifiant,
			nom: req.session.nom,
			email: req.session.email,
			langue: req.session.langue,
			statut: req.session.statut,
			acces: req.session.acces,
			murs: req.session.murs,
			digidrive: req.session.digidrive
		}
		const pageContext = await renderPage(pageContextInit)
		const { httpResponse } = pageContext
		if (!httpResponse) return next()
		const { body, statusCode, contentType, earlyHints } = httpResponse
		if (res.writeEarlyHints) res.writeEarlyHints({ link: earlyHints.map((e) => e.earlyHintLink) })
		res.status(statusCode).type(contentType).send(body)
  	})

	app.get('/maintenance', async function (req, res, next) {
		if (maintenance === false) {
			res.redirect('/')
			return false
		}
		let langue = 'fr'
		if (req.session.hasOwnProperty('langue') && req.session.langue !== '') {
			langue = req.session.langue
		}
		const pageContextInit = {
			urlOriginal: req.originalUrl,
			langue: langue
		}
		const pageContext = await renderPage(pageContextInit)
		const { httpResponse } = pageContext
		if (!httpResponse) {
			return next()
		}
		const { body, statusCode, contentType, earlyHints } = httpResponse
		if (res.writeEarlyHints) {
			res.writeEarlyHints({ link: earlyHints.map((e) => e.earlyHintLink) })
		}
		res.status(statusCode).type(contentType).send(body)
  	})
	
	app.get('/admin', async function (req, res, next) {
		let langue = 'fr'
		if (req.session.hasOwnProperty('langue') && req.session.langue !== '') {
			langue = req.session.langue
		}
		const pageContextInit = {
			urlOriginal: req.originalUrl,
			hote: hote,
			langue: langue
		}
		const pageContext = await renderPage(pageContextInit)
		const { httpResponse } = pageContext
		if (!httpResponse) {
			return next()
		}
		const { body, statusCode, contentType, earlyHints } = httpResponse
		if (res.writeEarlyHints) {
			res.writeEarlyHints({ link: earlyHints.map((e) => e.earlyHintLink) })
		}
		res.status(statusCode).type(contentType).send(body)
  	})

	app.post('/api/inscription', function (req, res) {
		const identifiant = req.body.identifiant
		const motdepasse = req.body.motdepasse
		const email = req.body.email
		db.exists('utilisateurs:' + identifiant, async function (err, reponse) {
			if (err) { res.send('erreur'); return false  }
			if (reponse === 0) {
				const hash = await bcrypt.hash(motdepasse, 10)
				const date = dayjs().format()
				let langue = 'fr'
				if (req.session.hasOwnProperty('langue') && req.session.langue !== '' && req.session.langue !== undefined) {
					langue = req.session.langue
				}
				const multi = db.multi()
				multi.hmset('utilisateurs:' + identifiant, 'id', identifiant, 'motdepasse', hash, 'date', date, 'nom', '', 'email', email, 'langue', langue, 'affichage', 'liste', 'classement', 'date-asc', 'dossiers', JSON.stringify([]))
				multi.sadd('emails:' + email, identifiant)
				multi.exec(function () {
					req.session.identifiant = identifiant
					req.session.nom = ''
					req.session.email = email
					req.session.langue = langue
					req.session.statut = 'utilisateur'
					req.session.cookie.expires = new Date(Date.now() + dureeSession)
					res.json({ identifiant: identifiant })
				})
			} else {
				res.send('utilisateur_existe_deja')
			}
		})
	})

	app.post('/api/connexion', function (req, res) {
		const identifiant = req.body.identifiant
		const motdepasse = req.body.motdepasse
		db.exists('utilisateurs:' + identifiant, function (err, reponse) {
			if (err) { res.send('erreur_connexion'); return false }
			if (reponse === 1) {
				db.hgetall('utilisateurs:' + identifiant, async function (err, donnees) {
					if (err) { res.send('erreur_connexion'); return false }
					const comparaison = await bcrypt.compare(motdepasse, donnees.motdepasse)
					let comparaisonTemp = false
					if (donnees.hasOwnProperty('motdepassetemp')) {
						comparaisonTemp = await bcrypt.compare(motdepasse, donnees.motdepassetemp)
					}
					if (comparaison === true || comparaisonTemp === true) {
						if (comparaisonTemp === true) {
							const hash = await bcrypt.hash(motdepasse, 10)
							db.hset('utilisateurs:' + identifiant, 'motdepasse', hash)
							db.hdel('utilisateurs:' + identifiant, 'motdepassetemp')
						}
						const nom = donnees.nom
						const langue = donnees.langue
						const email = donnees.email
						req.session.identifiant = identifiant
						req.session.nom = nom
						req.session.langue = langue
						req.session.statut = 'utilisateur'
						req.session.email = email
						req.session.cookie.expires = new Date(Date.now() + dureeSession)
						res.json({ identifiant: identifiant })
					} else {
						res.send('erreur_connexion')
					}
				})
			} else {
				res.send('erreur_connexion')
			}
		})
	})

	app.post('/api/mot-de-passe-oublie', function (req, res) {
		const email = req.body.email.trim()
		db.smembers('emails:' + email, function (err, identifiants) {
			if (err) { res.send('erreur'); return false }
			if (identifiants.length > 0) {
				const emails = []
				for (const identifiant of identifiants) {
					const emailEnvoye = new Promise(function (resolve) {
						const motdepasse = genererMotDePasse(7)
						const message = {
							from: '"La Digitale" <' + process.env.EMAIL_ADDRESS + '>',
							to: '"Moi" <' + email + '>',
							subject: 'Mot de passe Digiwall',
							html: '<p>Votre nouveau mot de passe : ' + motdepasse + '</p><p>Identifiant : ' + identifiant + '</p>'
						}
						transporter.sendMail(message, async function (err) {
							if (err) {
								resolve()
							} else {
								const hash = await bcrypt.hash(motdepasse, 10)
								db.hset('utilisateurs:' + identifiant, 'motdepassetemp', hash)
								resolve()
							}
						})
					})
					emails.push(emailEnvoye)
				}
				Promise.all(emails).then(function () {
					res.send('message_envoye')
				})
			} else {
				res.send('email_invalide')
			}
		})
	})

	app.post('/api/deconnexion', function (req, res) {
		req.session.identifiant = ''
		req.session.nom = ''
		req.session.email = ''
		req.session.langue = ''
		req.session.statut = ''
		req.session.destroy()
		res.send('deconnecte')
	})

	app.post('/api/recuperer-donnees-utilisateur', function (req, res) {
		const identifiant = req.body.identifiant
		recupererDonneesUtilisateur(identifiant).then(function (murs) {
			let mursCrees = murs[0].filter(function (element) {
				if (element.hasOwnProperty('id')) {
					element.id = parseInt(element.id)
				}
				return element !== '' && Object.keys(element).length > 0
			})
			let mursRejoints = murs[1].filter(function (element) {
				if (element.hasOwnProperty('id')) {
					element.id = parseInt(element.id)
				}
				return element !== '' && Object.keys(element).length > 0
			})
			let mursAdmins = murs[2].filter(function (element) {
				if (element.hasOwnProperty('id')) {
					element.id = parseInt(element.id)
				}
				return element !== '' && Object.keys(element).length > 0
			})
			let mursFavoris = murs[3].filter(function (element) {
				if (element.hasOwnProperty('id')) {
					element.id = parseInt(element.id)
				}
				return element !== '' && Object.keys(element).length > 0
			})
			// Suppresion redondances murs rejoints et murs administrés
			mursRejoints.forEach(function (mur, index) {
				mursAdmins.forEach(function (murAdmin) {
					if (mur.id === murAdmin.id) {
						mursRejoints.splice(index, 1)
					}
				})
			})
			// Supprimer doublons
			mursCrees = mursCrees.filter((valeur, index, self) =>
				index === self.findIndex((t) => (
					t.id === valeur.id && t.token === valeur.token
				))
			)
			mursRejoints = mursRejoints.filter((valeur, index, self) =>
				index === self.findIndex((t) => (
					t.id === valeur.id && t.token === valeur.token
				))
			)
			mursAdmins = mursAdmins.filter((valeur, index, self) =>
				index === self.findIndex((t) => (
					t.id === valeur.id && t.token === valeur.token
				))
			)
			mursFavoris = mursFavoris.filter((valeur, index, self) =>
				index === self.findIndex((t) => (
					t.id === valeur.id && t.token === valeur.token
				))
			)
			// Récupération et vérification des dossiers utilisateur
			db.hgetall('utilisateurs:' + identifiant, function (err, donnees) {
				if (err || !donnees) {
					res.json({ mursCrees: mursCrees, mursRejoints: mursRejoints, mursAdmins: mursAdmins, mursFavoris: mursFavoris, dossiers: [], affichage: 'liste', classement: 'date-asc' })
				} else {
					let dossiers = []
					if (donnees.hasOwnProperty('dossiers')) {
						try {
							dossiers = JSON.parse(donnees.dossiers)
						} catch (err) {
							console.log(err)
						}
					}
					const listeMursDossiers = []
					dossiers.forEach(function (dossier, indexDossier) {
						dossier.murs.forEach(function (mur, indexMur) {
							dossiers[indexDossier].murs[indexMur] = parseInt(mur)
							if (!listeMursDossiers.includes(parseInt(mur))) {
								listeMursDossiers.push(parseInt(mur))
							}
						})
					})
					const donneesMursDossiers = []
					for (const mur of listeMursDossiers) {
						const donneeMursDossiers = new Promise(function (resolve) {
							db.exists('murs:' + mur, async function (err, resultat) {
								if (err) { resolve() }
								if (resultat === 1) {
									resolve()
								} else if (resultat !== 1 && await fs.pathExists(path.join(__dirname, '..', '/static/murs/mur-' + mur + '.json'))) {
									resolve()
								} else {
									resolve(parseInt(mur))
								}
							})
						})
						donneesMursDossiers.push(donneeMursDossiers)
					}
					Promise.all(donneesMursDossiers).then(function (mursSupprimes) {
						mursSupprimes.forEach(function (murSupprime) {
							if (murSupprime !== '' || murSupprime !== null) {
								dossiers.forEach(function (dossier, indexDossier) {
									if (dossier.murs.includes(murSupprime)) {
										const indexMur = dossier.murs.indexOf(murSupprime)
										dossiers[indexDossier].murs.splice(indexMur, 1)
									}
								})
							}
						})
						// Supprimer doublons dans dossiers
						dossiers.forEach(function (dossier, indexDossier) {
							const murs = []
							dossier.murs.forEach(function (mur, indexMur) {
								if (!murs.includes(mur)) {
									murs.push(mur)
								} else {
									dossiers[indexDossier].murs.splice(indexMur, 1)
								}
							})
						})
						db.hset('utilisateurs:' + identifiant, 'dossiers', JSON.stringify(dossiers), function () {
							res.json({ mursCrees: mursCrees, mursRejoints: mursRejoints, mursAdmins: mursAdmins, mursFavoris: mursFavoris, dossiers: dossiers, affichage: donnees.affichage, classement: donnees.classement })
						})
					})
				}
			})
		})
	})

	app.post('/api/recuperer-donnees-auteur', function (req, res) {
		const identifiant = req.body.identifiant
		recupererDonneesAuteur(identifiant).then(function (murs) {
			let mursCrees = murs[0].filter(function (element) {
				if (element.hasOwnProperty('id')) {
					element.id = parseInt(element.id)
				}
				return element !== '' && Object.keys(element).length > 0
			})
			let mursAdmins = murs[1].filter(function (element) {
				if (element.hasOwnProperty('id')) {
					element.id = parseInt(element.id)
				}
				return element !== '' && Object.keys(element).length > 0
			})
			// Supprimer doublons
			mursCrees = mursCrees.filter((valeur, index, self) =>
				index === self.findIndex((t) => (
					t.id === valeur.id && t.token === valeur.token
				))
			)
			mursAdmins = mursAdmins.filter((valeur, index, self) =>
				index === self.findIndex((t) => (
					t.id === valeur.id && t.token === valeur.token
				))
			)
			res.json({ mursCrees: mursCrees, mursAdmins: mursAdmins })
		})
	})

	app.post('/api/recuperer-donnees-mur', function (req, res) {
		const id = req.body.id
		const token = req.body.token
		const identifiant = req.body.identifiant
		const statut = req.body.statut
		db.exists('murs:' + id, function (err, resultat) {
			if (err) { res.send('erreur_mur'); return false }
			db.hgetall('murs:' + id, async function (err, mur) {
				if (err) { res.send('erreur_mur'); return false }
				if (resultat === 1 && mur !== null) {
					recupererDonneesMur(id, token, identifiant, statut, res)
				} else if ((resultat !== 1 || mur === null) && await fs.pathExists(path.join(__dirname, '..', '/static/murs/' + id + '.json'))) {
					const donnees = await fs.readJson(path.join(__dirname, '..', '/static/murs/' + id + '.json'))
					if (typeof donnees === 'object' && donnees !== null && donnees.hasOwnProperty('mur') && donnees.hasOwnProperty('blocs') && donnees.hasOwnProperty('activite')) {
						const donneesBlocs = []
						for (const [indexItem, item] of donnees.blocs.entries()) {
							const donneesBloc = new Promise(function (resolve) {
								const multi = db.multi()
								multi.hmset('contenu-blocs:' + id + ':' + item.bloc, 'id', item.id, 'bloc', item.bloc, 'titre', item.titre, 'texte', item.texte, 'media', item.media, 'iframe', item.iframe, 'type', item.type, 'source', item.source, 'vignette', item.vignette, 'date', item.date, 'identifiant', item.identifiant, 'commentaires', item.commentaires, 'evaluations', item.evaluations, 'colonne', item.colonne, 'visibilite', item.visibilite)
								multi.zadd('blocs:' + id, indexItem, item.bloc)
								for (const commentaire of bloc.listeCommentaires) {
									if (commentaire.hasOwnProperty('id') && commentaire.hasOwnProperty('identifiant') && commentaire.hasOwnProperty('date') && commentaire.hasOwnProperty('texte')) {
										multi.zadd('commentaires:' + bloc.bloc, commentaire.id, JSON.stringify(commentaire))
									}
								}
								for (const evaluation of bloc.listeEvaluations) {
									if (evaluation.hasOwnProperty('id') && evaluation.hasOwnProperty('identifiant') && evaluation.hasOwnProperty('date') && evaluation.hasOwnProperty('etoiles')) {
										multi.zadd('evaluations:' + bloc.bloc, evaluation.id, JSON.stringify(evaluation))
									}
								}
								multi.exec(function () {
									resolve()
								})
							})
							donneesBlocs.push(donneesBloc)
						}
						Promise.all(donneesBlocs).then(function () {
							const multi = db.multi()
							if (donnees.mur.hasOwnProperty('motdepasse') && donnees.mur.hasOwnProperty('code')) {
								multi.hmset('murs:' + id, 'id', id, 'token', donnees.mur.token, 'titre', donnees.mur.titre, 'identifiant', donnees.mur.identifiant, 'fond', donnees.mur.fond, 'acces', donnees.mur.acces, 'motdepasse', donnees.mur.motdepasse, 'motdepasseAdmin', donnees.mur.motdepasseAdmin, 'code', donnees.mur.code, 'contributions', donnees.mur.contributions, 'affichage', donnees.mur.affichage, 'registreActivite', donnees.mur.registreActivite, 'conversation', donnees.mur.conversation, 'listeUtilisateurs', donnees.mur.listeUtilisateurs, 'editionNom', donnees.mur.editionNom, 'fichiers', donnees.mur.fichiers, 'enregistrements', donnees.mur.enregistrements, 'liens', donnees.mur.liens, 'documents', donnees.mur.documents, 'commentaires', donnees.mur.commentaires, 'evaluations', donnees.mur.evaluations, 'verrouillage', donnees.mur.verrouillage, 'copieBloc', donnees.mur.copieBloc, 'ordre', donnees.mur.ordre, 'largeur', donnees.mur.largeur, 'date', donnees.mur.date, 'colonnes', donnees.mur.colonnes, 'affichageColonnes', donnees.mur.affichageColonnes, 'bloc', donnees.mur.bloc, 'activite', donnees.mur.activite, 'admins', donnees.mur.admins, 'vues', donnees.mur.vues)
							} else if (donnees.mur.hasOwnProperty('motdepasse') && !donnees.mur.hasOwnProperty('code')) {
								multi.hmset('murs:' + id, 'id', id, 'token', donnees.mur.token, 'titre', donnees.mur.titre, 'identifiant', donnees.mur.identifiant, 'fond', donnees.mur.fond, 'acces', donnees.mur.acces, 'motdepasse', donnees.mur.motdepasse, 'motdepasseAdmin', donnees.mur.motdepasseAdmin, 'contributions', donnees.mur.contributions, 'affichage', donnees.mur.affichage, 'registreActivite', donnees.mur.registreActivite, 'conversation', donnees.mur.conversation, 'listeUtilisateurs', donnees.mur.listeUtilisateurs, 'editionNom', donnees.mur.editionNom, 'fichiers', donnees.mur.fichiers, 'enregistrements', donnees.mur.enregistrements, 'liens', donnees.mur.liens, 'documents', donnees.mur.documents, 'commentaires', donnees.mur.commentaires, 'evaluations', donnees.mur.evaluations, 'verrouillage', donnees.mur.verrouillage, 'copieBloc', donnees.mur.copieBloc, 'ordre', donnees.mur.ordre, 'largeur', donnees.mur.largeur, 'date', donnees.mur.date, 'colonnes', donnees.mur.colonnes, 'affichageColonnes', donnees.mur.affichageColonnes, 'bloc', donnees.mur.bloc, 'activite', donnees.mur.activite, 'admins', donnees.mur.admins, 'vues', donnees.mur.vues)
							} else if (donnees.mur.hasOwnProperty('code')) {
								multi.hmset('murs:' + id, 'id', id, 'token', donnees.mur.token, 'titre', donnees.mur.titre, 'identifiant', donnees.mur.identifiant, 'fond', donnees.mur.fond, 'acces', donnees.mur.acces, 'motdepasseAdmin', donnees.mur.motdepasseAdmin, 'code', donnees.mur.code, 'contributions', donnees.mur.contributions, 'affichage', donnees.mur.affichage, 'registreActivite', donnees.mur.registreActivite, 'conversation', donnees.mur.conversation, 'listeUtilisateurs', donnees.mur.listeUtilisateurs, 'editionNom', donnees.mur.editionNom, 'fichiers', donnees.mur.fichiers, 'enregistrements', donnees.mur.enregistrements, 'liens', donnees.mur.liens, 'documents', donnees.mur.documents, 'commentaires', donnees.mur.commentaires, 'evaluations', donnees.mur.evaluations, 'verrouillage', donnees.mur.verrouillage, 'copieBloc', donnees.mur.copieBloc, 'ordre', donnees.mur.ordre, 'largeur', donnees.mur.largeur, 'date', donnees.mur.date, 'colonnes', donnees.mur.colonnes, 'affichageColonnes', donnees.mur.affichageColonnes, 'bloc', donnees.mur.bloc, 'activite', donnees.mur.activite, 'admins', donnees.mur.admins, 'vues', donnees.mur.vues)
							} else {
								multi.hmset('murs:' + id, 'id', id, 'token', donnees.mur.token, 'titre', donnees.mur.titre, 'identifiant', donnees.mur.identifiant, 'fond', donnees.mur.fond, 'acces', donnees.mur.acces, 'motdepasseAdmin', donnees.mur.motdepasseAdmin, 'contributions', donnees.mur.contributions, 'affichage', donnees.mur.affichage, 'registreActivite', donnees.mur.registreActivite, 'conversation', donnees.mur.conversation, 'listeUtilisateurs', donnees.mur.listeUtilisateurs, 'editionNom', donnees.mur.editionNom, 'fichiers', donnees.mur.fichiers, 'enregistrements', donnees.mur.enregistrements, 'liens', donnees.mur.liens, 'documents', donnees.mur.documents, 'commentaires', donnees.mur.commentaires, 'evaluations', donnees.mur.evaluations, 'verrouillage', donnees.mur.verrouillage, 'copieBloc', donnees.mur.copieBloc, 'ordre', donnees.mur.ordre, 'largeur', donnees.mur.largeur, 'date', donnees.mur.date, 'colonnes', donnees.mur.colonnes, 'affichageColonnes', donnees.mur.affichageColonnes, 'bloc', donnees.mur.bloc, 'activite', donnees.mur.activite, 'admins', donnees.mur.admins, 'vues', donnees.mur.vues)
							}
							for (const activite of donnees.activite) {
								if (activite.hasOwnProperty('bloc') && activite.hasOwnProperty('identifiant') && activite.hasOwnProperty('titre') && activite.hasOwnProperty('date') && activite.hasOwnProperty('type') && activite.hasOwnProperty('id')) {
									multi.zadd('activite:' + id, activite.id, JSON.stringify(activite))
								}
							}
							multi.exec(async function () {
								await fs.remove(path.join(__dirname, '..', '/static/murs/' + id + '.json'))
								await fs.remove(path.join(__dirname, '..', '/static/murs/mur-' + id + '.json'))
								recupererDonneesMur(id, token, identifiant, statut, res)
							})
						})
					} else {
						res.send('erreur_mur')
					}
				} else {
					res.send('erreur_mur')
				}
			})
		})
	})

	app.post('/api/creer-mur', function (req, res) {
		if (maintenance === true) {
			res.redirect('/maintenance')
			return false
		}
		const identifiant = req.body.identifiant
		if (req.session.identifiant && req.session.identifiant === identifiant) {
			const titre = req.body.titre
			const token = Math.random().toString(16).slice(10)
			const slug = definirSlug(titre)
			const date = dayjs().format()
			db.exists('mur', function (err, resultat) {
				if (err) { res.send('erreur_creation'); return false }
				if (resultat === 1) {
					db.get('mur', function (err, resultat) {
						if (err) { res.send('erreur_creation'); return false }
						const id = parseInt(resultat) + 1
						creerMur(res, id, token, slug, titre, date, identifiant)
					})
				} else {
					creerMur(res, 1, token, slug, titre, date, identifiant)
				}
			})
		} else {
			res.send('non_connecte')
		}
	})

	app.post('/api/creer-mur-sans-compte', async function (req, res) {
		if (maintenance === true) {
			res.redirect('/maintenance')
			return false
		}
		let identifiant, nom
		if (req.session.identifiant === '' || req.session.identifiant === undefined || (req.session.identifiant.length !== 13 && req.session.identifiant.substring(0, 1) !== 'u')) {
			identifiant = 'u' + Math.random().toString(16).slice(3)
			nom = identifiant.slice(0, 8).toUpperCase()
			req.session.identifiant = identifiant
			req.session.nom = nom
		} else {
			identifiant = req.session.identifiant
			nom = req.session.nom
		}
		if (!req.session.hasOwnProperty('digidrive')) {
			req.session.digidrive = []
		}
		const titre = req.body.titre
		const motdepasse = req.body.motdepasse
		const hash = await bcrypt.hash(motdepasse, 10)
		const token = Math.random().toString(16).slice(10)
		const slug = definirSlug(titre)
		const date = dayjs().format()
		let langue = 'fr'
		if (req.session.hasOwnProperty('langue') && req.session.langue !== '' && req.session.langue !== undefined) {
			langue = req.session.langue
		}
		db.exists('mur', function (err, resultat) {
			if (err) { res.send('erreur_creation'); return false }
			if (resultat === 1) {
				db.get('mur', function (err, resultat) {
					if (err) { res.send('erreur_creation'); return false }
					const id = parseInt(resultat) + 1
					creerMurSansCompte(req, res, id, token, slug, titre, hash, date, identifiant, nom, langue, '')
				})
			} else {
				creerMurSansCompte(req, res, 1, token, slug, titre, hash, date, identifiant, nom, langue, '')
			}
		})
	})

	app.post('/api/deconnecter-mur', function (req, res) {
		const identifiant = req.body.identifiant
		if (req.session.identifiant && req.session.identifiant === identifiant) {
			req.session.identifiant = ''
			req.session.statut = ''
			res.send('deconnecte')
		} else {
			res.send('non_connecte')
		}
	})

	app.post('/api/modifier-mot-de-passe-mur', function (req, res) {
		if (maintenance === true) {
			res.redirect('/maintenance')
			return false
		}
		const identifiant = req.body.identifiant
		if (req.session.identifiant && req.session.identifiant === identifiant) {
			const mur = req.body.mur
			db.hgetall('murs:' + mur, async function (err, donnees) {
				if (err) { res.send('erreur'); return false }
				if (await bcrypt.compare(req.body.motdepasse, donnees.motdepasse)) {
					const hash = await bcrypt.hash(req.body.nouveaumotdepasse, 10)
					db.hset('murs:' + mur, 'motdepasse', hash)
					res.send('motdepasse_modifie')
				} else {
					res.send('motdepasse_incorrect')
				}
			})
		} else {
			res.send('non_connecte')
		}
	})

	app.post('/api/ajouter-mur-favoris', function (req, res) {
		const identifiant = req.body.identifiant
		if (req.session.identifiant && req.session.identifiant === identifiant) {
			const mur = req.body.murId
			db.sadd('murs-favoris:' + identifiant, mur, function (err) {
				if (err) { res.send('erreur_ajout_favori'); return false }
				res.send('mur_ajoute_favoris')
			})
		} else {
			res.send('non_connecte')
		}
	})

	app.post('/api/supprimer-mur-favoris', function (req, res) {
		const identifiant = req.body.identifiant
		if (req.session.identifiant && req.session.identifiant === identifiant) {
			const mur = req.body.murId
			db.srem('murs-favoris:' + identifiant, mur, function (err) {
				if (err) { res.send('erreur_suppression_favori'); return false }
				res.send('mur_supprime_favoris')
			})
		} else {
			res.send('non_connecte')
		}
	})

	app.post('/api/deplacer-mur', function (req, res) {
		const identifiant = req.body.identifiant
		if (req.session.identifiant && req.session.identifiant === identifiant) {
			const murId = req.body.murId
			const destination = req.body.destination
			db.hgetall('utilisateurs:' + identifiant, function (err, donnees) {
				if (err) { res.send('erreur_deplacement'); return false }
				const dossiers = JSON.parse(donnees.dossiers)
				dossiers.forEach(function (dossier, indexDossier) {
					if (dossier.murs.includes(murId)) {
						const indexMur = dossier.murs.indexOf(murId)
						dossiers[indexDossier].murs.splice(indexMur, 1)
					}
					if (dossier.id === destination) {
						dossiers[indexDossier].murs.push(murId)
					}
				})
				db.hset('utilisateurs:' + identifiant, 'dossiers', JSON.stringify(dossiers), function (err) {
					if (err) { res.send('erreur_deplacement'); return false }
					res.send('mur_deplace')
				})
			})
		} else {
			res.send('non_connecte')
		}
	})

	app.post('/api/dupliquer-mur', function (req, res) {
		if (maintenance === true) {
			res.redirect('/maintenance')
			return false
		}
		const identifiant = req.body.identifiant
		if (req.session.identifiant && req.session.identifiant === identifiant) {
			const mur = req.body.murId
			db.get('mur', function (err, num) {
				if (err) { res.send('erreur_duplication'); return false }
				const id = parseInt(num) + 1
				db.exists('murs:' + mur, async function (err, resultat) {
					if (err) { res.send('erreur_duplication'); return false }
					if (resultat === 1) {
						db.hgetall('murs:' + mur, function (err, donnees) {
							if (err) { res.send('erreur_duplication'); return false }
							const donneesBlocs = []
							db.zrange('blocs:' + mur, 0, -1, function (err, blocs) {
								if (err) { res.send('erreur_duplication'); return false }
								for (const [indexBloc, bloc] of blocs.entries()) {
									const donneesBloc = new Promise(function (resolve) {
										db.hgetall('contenu-blocs:' + mur + ':' + bloc, function (err, infos) {
											if (err || !infos) { resolve({}) }
											const date = dayjs().format()
											if (infos.hasOwnProperty('vignette') && infos.vignette !== '') {
												infos.vignette = infos.vignette.replace('/' + definirDossierFichiers(mur) + '/' + mur, '/' + definirDossierFichiers(id) + '/' + id)
											}
											if (infos.hasOwnProperty('iframe') && infos.iframe !== '' && infos.iframe.includes(etherpad)) {
												const etherpadId = infos.iframe.replace(etherpad + '/p/', '')
												const destinationId = 'mur-' + id + '-' + Math.random().toString(16).slice(2)
												const url = etherpad + '/api/1.2.14/copyPad?apikey=' + etherpadApi + '&sourceID=' + etherpadId + '&destinationID=' + destinationId
												axios.get(url)
												infos.iframe = etherpad + '/p/' + destinationId
												infos.media = etherpad + '/p/' + destinationId
											}
											const multi = db.multi()
											const blocId = 'bloc-id-' + (new Date()).getTime() + Math.random().toString(16).slice(10)
											multi.hmset('contenu-blocs:' + id + ':' + blocId, 'id', infos.id, 'bloc', blocId, 'typeBloc', infos.typeBloc, 'titre', infos.titre, 'texte', infos.texte, 'media', infos.media, 'iframe', infos.iframe, 'type', infos.type, 'source', infos.source, 'vignette', infos.vignette, 'vignetteActivee', infos.vignetteActivee, 'mediaExtra', infos.mediaExtra, 'medias', infos.medias, 'edition', infos.edition, 'date', date, 'identifiant', infos.identifiant, 'commentaires', 0, 'evaluations', 0, 'colonne', infos.colonne, 'visibilite', infos.visibilite, 'couleur', infos.couleur)
											multi.zadd('blocs:' + id, indexBloc, blocId)
											multi.exec(function () {
												resolve(blocId)
											})
										})
									})
									donneesBlocs.push(donneesBloc)
								}
								Promise.all(donneesBlocs).then(function () {
									const token = Math.random().toString(16).slice(10)
									const slug = definirSlug(donnees.titre)
									const date = dayjs().format()
									const code = Math.floor(1000 + Math.random() * 9000)
									const multi = db.multi()
									multi.incr('mur')
									if (donnees.hasOwnProperty('code')) {
										multi.hmset('murs:' + id, 'id', id, 'token', token, 'titre', 'Copie de ' + donnees.titre, 'identifiant', identifiant, 'fond', donnees.fond, 'acces', donnees.acces, 'motdepasseAdmin', donnees.motdepasseAdmin, 'code', code, 'contributions', donnees.contributions, 'affichage', donnees.affichage, 'registreActivite', donnees.registreActivite, 'conversation', donnees.conversation, 'listeUtilisateurs', donnees.listeUtilisateurs, 'editionNom', donnees.editionNom, 'fichiers', donnees.fichiers, 'enregistrements', donnees.enregistrements, 'liens', donnees.liens, 'documents', donnees.documents, 'commentaires', donnees.commentaires, 'evaluations', donnees.evaluations, 'verrouillage', donnees.verrouillage, 'copieBloc', donnees.copieBloc, 'ordre', donnees.ordre, 'largeur', donnees.largeur, 'date', date, 'colonnes', donnees.colonnes, 'affichageColonnes', donnees.affichageColonnes, 'bloc', donnees.bloc, 'activite', 0, 'admins', JSON.stringify([]), 'vues', 0)
									} else {
										multi.hmset('murs:' + id, 'id', id, 'token', token, 'titre', 'Copie de ' + donnees.titre, 'identifiant', identifiant, 'fond', donnees.fond, 'acces', donnees.acces, 'motdepasseAdmin', donnees.motdepasseAdmin, 'contributions', donnees.contributions, 'affichage', donnees.affichage, 'registreActivite', donnees.registreActivite, 'conversation', donnees.conversation, 'listeUtilisateurs', donnees.listeUtilisateurs, 'editionNom', donnees.editionNom, 'fichiers', donnees.fichiers, 'enregistrements', donnees.enregistrements, 'liens', donnees.liens, 'documents', donnees.documents, 'commentaires', donnees.commentaires, 'evaluations', donnees.evaluations, 'verrouillage', donnees.verrouillage, 'copieBloc', donnees.copieBloc, 'ordre', donnees.ordre, 'largeur', donnees.largeur, 'date', date, 'colonnes', donnees.colonnes, 'affichageColonnes', donnees.affichageColonnes, 'bloc', donnees.bloc, 'activite', 0, 'admins', JSON.stringify([]), 'vues', 0)
									}
									multi.sadd('murs-crees:' + identifiant, id)
									multi.sadd('utilisateurs-murs:' + id, identifiant)
									multi.exec(async function () {
										if (await fs.pathExists(path.join(__dirname, '..', '/static/' + definirDossierFichiers(mur) + '/' + mur))) {
											await fs.copy(path.join(__dirname, '..', '/static/' + definirDossierFichiers(mur) + '/' + mur), path.join(__dirname, '..', '/static/' + definirDossierFichiers(id) + '/' + id))
										}
										res.json({ id: id, token: token, slug: slug, titre: 'Copie de ' + donnees.titre, identifiant: identifiant, fond: donnees.fond, acces: donnees.acces, motdepasseAdmin: donnees.motdepasseAdmin, code: code, contributions: donnees.contributions, affichage: donnees.affichage, registreActivite: donnees.registreActivite, conversation: donnees.conversation, listeUtilisateurs: donnees.listeUtilisateurs, editionNom: donnees.editionNom, fichiers: donnees.fichiers, enregistrements: donnees.enregistrements, liens: donnees.liens, documents: donnees.documents, commentaires: donnees.commentaires, evaluations: donnees.evaluations, verrouillage: donnees.verrouillage, copieBloc: donnees.copieBloc, ordre: donnees.ordre, largeur: donnees.largeur, date: date, colonnes: donnees.colonnes, affichageColonnes: donnees.affichageColonnes, bloc: donnees.bloc, activite: 0, admins: [], vues: 0 })
									})
								})
							})
						})
					} else if (resultat !== 1 && await fs.pathExists(path.join(__dirname, '..', '/static/murs/' + mur + '.json'))) {
						const donnees = await fs.readJson(path.join(__dirname, '..', '/static/murs/' + mur + '.json'))
						if (typeof donnees === 'object' && donnees !== null && donnees.hasOwnProperty('mur') && donnees.hasOwnProperty('blocs') && donnees.hasOwnProperty('activite')) {
							const date = dayjs().format()
							const donneesBlocs = []
							for (const [indexBloc, bloc] of donnees.blocs.entries()) {
								const donneesBloc = new Promise(function (resolve) {
									if (Object.keys(bloc).length > 0) {
										if (bloc.hasOwnProperty('vignette') && bloc.vignette !== '') {
											bloc.vignette = bloc.vignette.replace('/' + definirDossierFichiers(mur) + '/' + mur, '/' + definirDossierFichiers(id) + '/' + id)
										}
										if (bloc.hasOwnProperty('iframe') && bloc.iframe !== '' && bloc.iframe.includes(etherpad)) {
											const etherpadId = bloc.iframe.replace(etherpad + '/p/', '')
											const destinationId = 'mur-' + id + '-' + Math.random().toString(16).slice(2)
											const url = etherpad + '/api/1.2.14/copyPad?apikey=' + etherpadApi + '&sourceID=' + etherpadId + '&destinationID=' + destinationId
											axios.get(url)
											bloc.iframe = etherpad + '/p/' + destinationId
											bloc.media = etherpad + '/p/' + destinationId
										}
										const multi = db.multi()
										const blocId = 'bloc-id-' + (new Date()).getTime() + Math.random().toString(16).slice(10)
										multi.hmset('contenu-blocs:' + id + ':' + blocId, 'id', bloc.id, 'bloc', blocId, 'typeBloc', bloc.typeBloc, 'titre', bloc.titre, 'texte', bloc.texte, 'media', bloc.media, 'iframe', bloc.iframe, 'type', bloc.type, 'source', bloc.source, 'vignette', bloc.vignette, 'vignetteActivee', bloc.vignetteActivee, 'mediaExtra', bloc.mediaExtra, 'medias', bloc.medias, 'edition', bloc.edition, 'date', date, 'identifiant', bloc.identifiant, 'commentaires', 0, 'evaluations', 0, 'colonne', bloc.colonne, 'visibilite', bloc.visibilite, 'couleur', bloc.couleur)
										multi.zadd('blocs:' + id, indexBloc, blocId)
										multi.exec(function () {
											resolve(blocId)
										})
									} else {
										resolve({})
									}
								})
								donneesBlocs.push(donneesBloc)
							}
							Promise.all(donneesBlocs).then(function () {
								const token = Math.random().toString(16).slice(10)
								const slug = definirSlug(donnees.mur.titre)
								const code = Math.floor(1000 + Math.random() * 9000)
								const multi = db.multi()
								multi.incr('mur')
								if (donnees.mur.hasOwnProperty('code')) {
									multi.hmset('murs:' + id, 'id', id, 'token', token, 'titre', 'Copie de ' + donnees.mur.titre, 'identifiant', identifiant, 'fond', donnees.mur.fond, 'acces', donnees.mur.acces, 'motdepasseAdmin', donnees.mur.motdepasseAdmin, 'code', code, 'contributions', donnees.mur.contributions, 'affichage', donnees.mur.affichage, 'registreActivite', donnees.mur.registreActivite, 'conversation', donnees.mur.conversation, 'listeUtilisateurs', donnees.mur.listeUtilisateurs, 'editionNom', donnees.mur.editionNom, 'fichiers', donnees.mur.fichiers, 'enregistrements', donnees.mur.enregistrements, 'liens', donnees.mur.liens, 'documents', donnees.mur.documents, 'commentaires', donnees.mur.commentaires, 'evaluations', donnees.mur.evaluations, 'verrouillage', donnees.mur.verrouillage, 'copieBloc', donnees.mur.copieBloc, 'ordre', donnees.mur.ordre, 'largeur', largeur, 'date', date, 'colonnes', donnees.mur.colonnes, 'affichageColonnes', donnees.mur.affichageColonnes, 'bloc', donnees.mur.bloc, 'activite', 0, 'admins', JSON.stringify([]), 'vues', 0)
								} else {
									multi.hmset('murs:' + id, 'id', id, 'token', token, 'titre', 'Copie de ' + donnees.mur.titre, 'identifiant', identifiant, 'fond', donnees.mur.fond, 'acces', donnees.mur.acces, 'motdepasseAdmin', donnees.mur.motdepasseAdmin, 'contributions', donnees.mur.contributions, 'affichage', donnees.mur.affichage, 'registreActivite', donnees.mur.registreActivite, 'conversation', donnees.mur.conversation, 'listeUtilisateurs', donnees.mur.listeUtilisateurs, 'editionNom', donnees.mur.editionNom, 'fichiers', donnees.mur.fichiers, 'enregistrements', donnees.mur.enregistrements, 'liens', donnees.mur.liens, 'documents', donnees.mur.documents, 'commentaires', donnees.mur.commentaires, 'evaluations', donnees.mur.evaluations, 'verrouillage', donnees.mur.verrouillage, 'copieBloc', donnees.mur.copieBloc, 'ordre', donnees.mur.ordre, 'largeur', donnees.mur.largeur, 'date', date, 'colonnes', donnees.mur.colonnes, 'affichageColonnes', donnees.mur.affichageColonnes, 'bloc', donnees.mur.bloc, 'activite', 0, 'admins', JSON.stringify([]), 'vues', 0)
								}
								multi.sadd('murs-crees:' + identifiant, id)
								multi.sadd('utilisateurs-murs:' + id, identifiant)
								multi.exec(async function () {
									if (await fs.pathExists(path.join(__dirname, '..', '/static/' + definirDossierFichiers(mur) + '/' + mur))) {
										await fs.copy(path.join(__dirname, '..', '/static/' + definirDossierFichiers(mur) + '/' + mur), path.join(__dirname, '..', '/static/' + definirDossierFichiers(id) + '/' + id))
									}
									res.json({ id: id, token: token, slug: slug, titre: 'Copie de ' + donnees.mur.titre, identifiant: identifiant, fond: donnees.mur.fond, acces: donnees.mur.acces, motdepasseAdmin: donnees.mur.motdepasseAdmin, code: code, contributions: donnees.mur.contributions, affichage: donnees.mur.affichage, registreActivite: donnees.mur.registreActivite, conversation: donnees.mur.conversation, listeUtilisateurs: donnees.mur.listeUtilisateurs, editionNom: donnees.mur.editionNom, fichiers: donnees.mur.fichiers, enregistrements: donnees.mur.enregistrements, liens: donnees.mur.liens, documents: donnees.mur.documents, commentaires: donnees.mur.commentaires, evaluations: donnees.mur.evaluations, verrouillage: donnees.mur.verrouillage, copieBloc: donnees.mur.copieBloc, ordre: donnees.mur.ordre, largeur: donnees.mur.largeur, date: date, colonnes: donnees.mur.colonnes, affichageColonnes: donnees.mur.affichageColonnes, bloc: donnees.mur.bloc, activite: 0, admins: [], vues: 0 })
								})
							})
						} else {
							res.send('erreur_duplication')
						}
					}
				})
			})
		} else {
			res.send('non_connecte')
		}
	})

	app.post('/api/exporter-mur', function (req, res) {
		const identifiant = req.body.identifiant
		const admin = req.body.admin
		const motdepasseAdmin = process.env.VITE_ADMIN_PASSWORD
		if ((req.session.identifiant && req.session.identifiant === identifiant) || (admin !== '' && admin === motdepasseAdmin)) {
			const id = req.body.murId
			db.exists('murs:' + id, async function (err, resultat) {
				if (resultat === 1) {
					const donneesMur = new Promise(function (resolveMain) {
						db.hgetall('murs:' + id, function (err, resultats) {
							if (err) { resolveMain({}) }
							resolveMain(resultats)
						})
					})
					const blocsMur = new Promise(function (resolveMain) {
						const donneesBlocs = []
						db.zrange('blocs:' + id, 0, -1, function (err, blocs) {
							if (err) { resolveMain(donneesBlocs) }
							for (const bloc of blocs) {
								const donneesBloc = new Promise(function (resolve) {
									db.hgetall('contenu-blocs:' + id + ':' + bloc, function (err, donnees) {
										if (err || !donnees) { resolve({}) }
										const donneesCommentaires = []
										db.zrange('commentaires:' + bloc, 0, -1, function (err, commentaires) {
											if (err || !commentaires) { resolve(donnees) }
											for (let commentaire of commentaires) {
												donneesCommentaires.push(JSON.parse(commentaire))
											}
											donnees.commentaires = donneesCommentaires.length
											donnees.listeCommentaires = donneesCommentaires
											db.zrange('evaluations:' + bloc, 0, -1, function (err, evaluations) {
												if (err || !evaluations) { resolve(donnees) }
												const donneesEvaluations = []
												evaluations.forEach(function (evaluation) {
													donneesEvaluations.push(JSON.parse(evaluation))
												})
												donnees.evaluations = donneesEvaluations.length
												donnees.listeEvaluations = donneesEvaluations
												db.exists('noms:' + donnees.identifiant, function (err, resultat) {
													if (err) { resolve(donnees) }
													if (resultat === 1) {
														db.hget('noms:' + donnees.identifiant, 'nom', function (err, nom) {
															if (err) { resolve(donnees) }
															donnees.nom = nom
															donnees.info = formaterDate(donnees, req.session.langue)
															resolve(donnees)
														})
													} else {
														if (donnees.identifiant.length === 13 && donnees.identifiant.substring(0, 1) === 'u') {
															donnees.nom = donnees.identifiant.slice(0, 8).toUpperCase()
														} else {
															donnees.nom = donnees.identifiant.toUpperCase()
														}
														donnees.info = formaterDate(donnees, req.session.langue)
														resolve(donnees)
													}
												})
											})
										})
									})
								})
								donneesBlocs.push(donneesBloc)
							}
							Promise.all(donneesBlocs).then(function (resultat) {
								resultat = resultat.filter(function (element) {
									return Object.keys(element).length > 0
								})
								resolveMain(resultat)
							})
						})
					})
					const activiteMur = new Promise(function (resolveMain) {
						const donneesEntrees = []
						db.zrange('activite:' + id, 0, -1, function (err, entrees) {
							if (err || !entrees) { resolveMain(donneesEntrees) }
							for (let entree of entrees) {
								entree = JSON.parse(entree)
								const donneesEntree = new Promise(function (resolve) {
									db.exists('utilisateurs:' + entree.identifiant, function (err) {
										if (err) { resolve({}) }
										resolve(entree)
									})
								})
								donneesEntrees.push(donneesEntree)
							}
							Promise.all(donneesEntrees).then(function (resultat) {
								resultat = resultat.filter(function (element) {
									return Object.keys(element).length > 0
								})
								resolveMain(resultat)
							})
						})
					})
					Promise.all([donneesMur, blocsMur, activiteMur]).then(async function (donnees) {
						if (donnees.length > 0 && donnees[0].hasOwnProperty('id')) {
							const parametres = {}
							parametres.mur = donnees[0]
							parametres.blocs = donnees[1]
							parametres.activite = donnees[2]
							const blocs = JSON.parse(JSON.stringify(donnees[1]))
							blocs.forEach(function (bloc, index) {
								blocs[index].medias = JSON.parse(bloc.medias)
							})
							const html = genererHTML(donnees[0], blocs)
							const chemin = path.join(__dirname, '..', '/static/temp')
							await fs.mkdirp(path.normalize(chemin + '/' + id))
							await fs.mkdirp(path.normalize(chemin + '/' + id + '/fichiers'))
							await fs.mkdirp(path.normalize(chemin + '/' + id + '/static'))
							await fs.writeFile(path.normalize(chemin + '/' + id + '/donnees.json'), JSON.stringify(parametres, '', 4), 'utf8')
							await fs.writeFile(path.normalize(chemin + '/' + id + '/index.html'), html, 'utf8')
							if (!parametres.mur.fond.includes('/img/') && parametres.mur.fond.substring(0, 1) !== '#' && await fs.pathExists(path.join(__dirname, '..', '/static' + parametres.mur.fond))) {
								await fs.copy(path.join(__dirname, '..', '/static' + parametres.mur.fond), path.normalize(chemin + '/' + id + '/fichiers/' + parametres.mur.fond.split('/').pop(), { overwrite: true }))
							} else if (parametres.mur.fond.includes('/img/') && await fs.pathExists(path.join(__dirname, '..', '/public' + parametres.mur.fond))) {
								await fs.copy(path.join(__dirname, '..', '/public' + parametres.mur.fond), path.normalize(chemin + '/' + id + '/static' + parametres.mur.fond, { overwrite: true }))
							}
							if (await fs.pathExists(path.join(__dirname, '..', '/static/export/css'))) {
								await fs.copy(path.join(__dirname, '..', '/static/export/css'), path.normalize(chemin + '/' + id + '/static/css'))
							}
							if (await fs.pathExists(path.join(__dirname, '..', '/static/export/js'))) {
								await fs.copy(path.join(__dirname, '..', '/static/export/js'), path.normalize(chemin + '/' + id + '/static/js'))
							}
							await fs.copy(path.join(__dirname, '..', '/public/fonts/MaterialIcons-Regular.woff'), path.normalize(chemin + '/' + id + '/static/fonts/MaterialIcons-Regular.woff'))
							await fs.copy(path.join(__dirname, '..', '/public/fonts/MaterialIcons-Regular.woff2'), path.normalize(chemin + '/' + id + '/static/fonts/MaterialIcons-Regular.woff2'))
							await fs.copy(path.join(__dirname, '..', '/public/fonts/Roboto-Slab-Medium.woff'), path.normalize(chemin + '/' + id + '/static/fonts/Roboto-Slab-Medium.woff'))
							await fs.copy(path.join(__dirname, '..', '/public/fonts/Roboto-Slab-Medium.woff2'), path.normalize(chemin + '/' + id + '/static/fonts/Roboto-Slab-Medium.woff2'))
							await fs.copy(path.join(__dirname, '..', '/public/img/favicon.png'), path.normalize(chemin + '/' + id + '/static/img/favicon.png'))
							for (const bloc of parametres.blocs) {
								if (Object.keys(bloc).length > 0 && bloc.media !== '' && bloc.type !== 'embed' && await fs.pathExists(path.join(__dirname, '..', '/static/' + definirDossierFichiers(id) + '/' + id + '/' + bloc.media))) {
									await fs.copy(path.join(__dirname, '..', '/static/' + definirDossierFichiers(id) + '/' + id + '/' + bloc.media), path.normalize(chemin + '/' + id + '/fichiers/' + bloc.media, { overwrite: true }))
								}
								if (Object.keys(bloc).length > 0 && bloc.mediaExtra !== '' && await fs.pathExists(path.join(__dirname, '..', '/static/' + definirDossierFichiers(id) + '/' + id + '/' + bloc.mediaExtra))) {
									await fs.copy(path.join(__dirname, '..', '/static/' + definirDossierFichiers(id) + '/' + id + '/' + bloc.mediaExtra), path.normalize(chemin + '/' + id + '/fichiers/' + bloc.mediaExtra, { overwrite: true }))
								}
								if (Object.keys(bloc).length > 0 && bloc.hasOwnProperty('medias')) {
									const medias = JSON.parse(bloc.medias)
									for (let i = 0; i < medias.length; i++) {
										if (medias[i].fichier !== '' && await fs.pathExists(path.join(__dirname, '..', '/static/' + definirDossierFichiers(id) + '/' + id + '/' + medias[i].fichier))) {
											await fs.copyFile(path.join(__dirname, '..', '/static/' + definirDossierFichiers(id) + '/' + id + '/' + medias[i].fichier), path.normalize(chemin + '/' + id + '/fichiers/' + medias[i].fichier, { overwrite: true }))
										}
									}
								}
								if (Object.keys(bloc).length > 0 && bloc.vignette && bloc.vignette !== '' && bloc.vignette.substring(1, definirDossierFichiers(id).length + 1) === definirDossierFichiers(id) && await fs.pathExists(path.join(__dirname, '..', '/static' + bloc.vignette))) {
									await fs.copy(path.join(__dirname, '..', '/static' + bloc.vignette), path.normalize(chemin + '/' + id + '/fichiers/' + bloc.vignette.replace('/' + definirDossierFichiers(id) + '/' + id + '/', ''), { overwrite: true }))
								} else if (Object.keys(bloc).length > 0 && bloc.vignette && bloc.vignette !== '' && bloc.vignette.includes('/img/') && !verifierURL(bloc.vignette, ['https', 'http']) && await fs.pathExists(path.join(__dirname, '..', '/static' + bloc.vignette))) {
									await fs.copy(path.join(__dirname, '..', '/static' + bloc.vignette), path.normalize(chemin + '/' + id + '/static' + bloc.vignette, { overwrite: true }))
								}
							}
							const archiveId = Math.floor((Math.random() * 100000) + 1)
							const sortie = fs.createWriteStream(path.normalize(chemin + '/mur-' + id + '_' + archiveId + '.zip'))
							const archive = archiver('zip', {
								zlib: { level: 9 }
							})
							sortie.on('finish', async function () {
								await fs.remove(path.normalize(chemin + '/' + id))
								res.send('mur-' + id + '_' + archiveId + '.zip')
							})
							archive.pipe(sortie)
							archive.directory(path.normalize(chemin + '/' + id), false)
							archive.finalize()
						} else {
							res.send('erreur_export')
						}
					})
				} else if (resultat !== 1 && await fs.pathExists(path.join(__dirname, '..', '/static/murs/' + id + '.json'))) {
					const donnees = await fs.readJson(path.join(__dirname, '..', '/static/murs/' + id + '.json'))
					if (typeof donnees === 'object' && donnees !== null && donnees.hasOwnProperty('mur') && donnees.hasOwnProperty('blocs') && donnees.hasOwnProperty('activite')) {
						const html = genererHTML(donnees[0], donnees[1])
						const chemin = path.join(__dirname, '..', '/static/temp')
						await fs.mkdirp(path.normalize(chemin + '/' + id))
						await fs.mkdirp(path.normalize(chemin + '/' + id + '/fichiers'))
						await fs.mkdirp(path.normalize(chemin + '/' + id + '/static'))
						await fs.writeFile(path.normalize(chemin + '/' + id + '/donnees.json'), JSON.stringify(donnees, '', 4), 'utf8')
						await fs.writeFile(path.normalize(chemin + '/' + id + '/index.html'), html, 'utf8')
						if (!parametres.mur.fond.includes('/img/') && parametres.mur.fond.substring(0, 1) !== '#' && await fs.pathExists(path.join(__dirname, '..', '/static' + parametres.mur.fond))) {
							await fs.copy(path.join(__dirname, '..', '/static' + parametres.mur.fond), path.normalize(chemin + '/' + id + '/fichiers/' + parametres.mur.fond.split('/').pop(), { overwrite: true }))
						} else if (parametres.mur.fond.includes('/img/') && await fs.pathExists(path.join(__dirname, '..', '/public' + parametres.mur.fond))) {
							await fs.copy(path.join(__dirname, '..', '/public' + parametres.mur.fond), path.normalize(chemin + '/' + id + '/static' + parametres.mur.fond, { overwrite: true }))
						}
						if (await fs.pathExists(path.join(__dirname, '..', '/static/export/css'))) {
							await fs.copy(path.join(__dirname, '..', '/static/export/css'), path.normalize(chemin + '/' + id + '/static/css'))
						}
						if (await fs.pathExists(path.join(__dirname, '..', '/static/export/js'))) {
							await fs.copy(path.join(__dirname, '..', '/static/export/js'), path.normalize(chemin + '/' + id + '/static/js'))
						}
						await fs.copy(path.join(__dirname, '..', '/public/fonts/MaterialIcons-Regular.woff'), path.normalize(chemin + '/' + id + '/static/fonts/MaterialIcons-Regular.woff'))
						await fs.copy(path.join(__dirname, '..', '/public/fonts/MaterialIcons-Regular.woff2'), path.normalize(chemin + '/' + id + '/static/fonts/MaterialIcons-Regular.woff2'))
						await fs.copy(path.join(__dirname, '..', '/public/fonts/Roboto-Slab-Medium.woff'), path.normalize(chemin + '/' + id + '/static/fonts/Roboto-Slab-Medium.woff'))
						await fs.copy(path.join(__dirname, '..', '/public/fonts/Roboto-Slab-Medium.woff2'), path.normalize(chemin + '/' + id + '/static/fonts/Roboto-Slab-Medium.woff2'))
						await fs.copy(path.join(__dirname, '..', '/static/img/favicon.png'), path.normalize(chemin + '/' + id + '/static/img/favicon.png'))
						for (const bloc of donnees.blocs) {
							if (Object.keys(bloc).length > 0 && bloc.media !== '' && bloc.type !== 'embed' && await fs.pathExists(path.join(__dirname, '..', '/static/' + definirDossierFichiers(id) + '/' + id + '/' + bloc.media))) {
								await fs.copy(path.join(__dirname, '..', '/static/' + definirDossierFichiers(id) + '/' + id + '/' + bloc.media), path.normalize(chemin + '/' + id + '/fichiers/' + bloc.media, { overwrite: true }))
							}
							if (Object.keys(bloc).length > 0 && bloc.mediaExtra !== '' && await fs.pathExists(path.join(__dirname, '..', '/static/' + definirDossierFichiers(id) + '/' + id + '/' + bloc.mediaExtra))) {
								await fs.copy(path.join(__dirname, '..', '/static/' + definirDossierFichiers(id) + '/' + id + '/' + bloc.mediaExtra), path.normalize(chemin + '/' + id + '/fichiers/' + bloc.mediaExtra, { overwrite: true }))
							}
							if (Object.keys(bloc).length > 0 && bloc.hasOwnProperty('medias')) {
								const medias = JSON.parse(bloc.medias)
								for (let i = 0; i < medias.length; i++) {
									if (medias[i].fichier !== '' && await fs.pathExists(path.join(__dirname, '..', '/static/' + definirDossierFichiers(id) + '/' + id + '/' + medias[i].fichier))) {
										await fs.copy(path.join(__dirname, '..', '/static/' + definirDossierFichiers(id) + '/' + id + '/' + medias[i].fichier), path.normalize(chemin + '/' + id + '/fichiers/' + medias[i].fichier, { overwrite: true }))
									}
								}
							}
							if (Object.keys(bloc).length > 0 && bloc.vignette && bloc.vignette !== '' && bloc.vignette.substring(1, definirDossierFichiers(id).length + 1) === definirDossierFichiers(id) && await fs.pathExists(path.join(__dirname, '..', '/static' + bloc.vignette))) {
								await fs.copy(path.join(__dirname, '..', '/static' + bloc.vignette), path.normalize(chemin + '/' + id + '/fichiers/' + bloc.vignette.replace('/' + definirDossierFichiers(id) + '/' + id + '/', ''), { overwrite: true }))
							} else if (Object.keys(bloc).length > 0 && bloc.vignette && bloc.vignette !== '' && bloc.vignette.includes('/img/') && !verifierURL(bloc.vignette, ['https', 'http']) && await fs.pathExists(path.join(__dirname, '..', '/static' + bloc.vignette))) {
								await fs.copy(path.join(__dirname, '..', '/static' + bloc.vignette), path.normalize(chemin + '/' + id + '/static' + bloc.vignette, { overwrite: true }))
							}
						}
						const archiveId = Math.floor((Math.random() * 100000) + 1)
						const sortie = fs.createWriteStream(path.normalize(chemin + '/mur-' + id + '_' + archiveId + '.zip'))
						const archive = archiver('zip', {
							zlib: { level: 9 }
						})
						sortie.on('finish', async function () {
							await fs.remove(path.normalize(chemin + '/' + id))
							res.send('mur-' + id + '_' + archiveId + '.zip')
						})
						archive.pipe(sortie)
						archive.directory(path.normalize(chemin + '/' + id), false)
						archive.finalize()
					} else {
						res.send('erreur_export')
					}
				}
			})
		} else {
			res.send('non_connecte')
		}
	})

	app.post('/api/importer-mur', function (req, res) {
		if (maintenance === true) {
			res.redirect('/maintenance')
			return false
		}
		const identifiant = req.session.identifiant
		if (!identifiant) {
			res.send('non_connecte')
		} else {
			televerserTemp(req, res, async function (err) {
				if (err) { res.send('erreur_import'); return false }
				try {
					const source = path.join(__dirname, '..', '/static/temp/' + req.file.filename)
					const cible = path.join(__dirname, '..', '/static/temp/archive-' + Math.floor((Math.random() * 100000) + 1))
					await extract(source, { dir: cible })
					const donnees = await fs.readJson(path.normalize(cible + '/donnees.json'))
					const parametres = JSON.parse(req.body.parametres)
					// Vérification des clés des données
					if (donnees.hasOwnProperty('mur') && donnees.hasOwnProperty('blocs') && donnees.hasOwnProperty('activite') && donnees.mur.hasOwnProperty('id') && donnees.mur.hasOwnProperty('token') && donnees.mur.hasOwnProperty('titre') && donnees.mur.hasOwnProperty('identifiant') && donnees.mur.hasOwnProperty('fond') && donnees.mur.hasOwnProperty('acces') && donnees.mur.hasOwnProperty('motdepasseAdmin') && donnees.mur.hasOwnProperty('contributions') && donnees.mur.hasOwnProperty('affichage') && donnees.mur.hasOwnProperty('registreActivite') && donnees.mur.hasOwnProperty('conversation') && donnees.mur.hasOwnProperty('listeUtilisateurs') && donnees.mur.hasOwnProperty('editionNom') && donnees.mur.hasOwnProperty('enregistrements') && donnees.mur.hasOwnProperty('ordre') && donnees.mur.hasOwnProperty('largeur') && donnees.mur.hasOwnProperty('affichageColonnes') && donnees.mur.hasOwnProperty('vues') && donnees.mur.hasOwnProperty('fichiers') && donnees.mur.hasOwnProperty('liens') && donnees.mur.hasOwnProperty('documents') && donnees.mur.hasOwnProperty('commentaires') && donnees.mur.hasOwnProperty('evaluations') && donnees.mur.hasOwnProperty('verrouillage') && donnees.mur.hasOwnProperty('copieBloc') && donnees.mur.hasOwnProperty('date') && donnees.mur.hasOwnProperty('colonnes') && donnees.mur.hasOwnProperty('bloc') && donnees.mur.hasOwnProperty('activite')) {
						db.get('mur', async function (err, resultat) {
							if (err) { res.send('erreur_import'); return false }
							const id = parseInt(resultat) + 1
							const chemin = path.join(__dirname, '..', '/static/' + definirDossierFichiers(id) + '/' + id)
							const donneesBlocs = []
							await fs.mkdirp(chemin)
							for (const [indexBloc, bloc] of donnees.blocs.entries()) {
								const donneesBloc = new Promise(function (resolve) {
									if (bloc.hasOwnProperty('id') && bloc.hasOwnProperty('bloc') && bloc.hasOwnProperty('typeBloc') && bloc.hasOwnProperty('titre') && bloc.hasOwnProperty('texte') && bloc.hasOwnProperty('media') && bloc.hasOwnProperty('iframe') && bloc.hasOwnProperty('type') && bloc.hasOwnProperty('source') && bloc.hasOwnProperty('vignette') && bloc.hasOwnProperty('vignetteActivee') && bloc.hasOwnProperty('mediaExtra') && bloc.hasOwnProperty('medias') && bloc.hasOwnProperty('edition') && bloc.hasOwnProperty('identifiant') && bloc.hasOwnProperty('commentaires') && bloc.hasOwnProperty('evaluations') && bloc.hasOwnProperty('colonne') && bloc.hasOwnProperty('visibilite') && bloc.hasOwnProperty('couleur') && bloc.hasOwnProperty('listeCommentaires') && bloc.hasOwnProperty('listeEvaluations')) {
										const date = dayjs().format()
										let commentaires = 0
										let evaluations = 0
										if (parametres.commentaires === true) {
											commentaires = bloc.commentaires
										}
										if (parametres.evaluations === true) {
											evaluations = bloc.evaluations
										}
										if (bloc.vignette !== '') {
											bloc.vignette = bloc.vignette.replace('/' + definirDossierFichiers(donnees.mur.id) + '/' + donnees.mur.id, '/' + definirDossierFichiers(id) + '/' + id)
										}
										const multi = db.multi()
										const blocId = 'bloc-id-' + (new Date()).getTime() + Math.random().toString(16).slice(10)
										multi.hmset('contenu-blocs:' + id + ':' + blocId, 'id', bloc.id, 'bloc', blocId, 'typeBloc', bloc.typeBloc, 'titre', bloc.titre, 'texte', bloc.texte, 'media', bloc.media, 'iframe', bloc.iframe, 'type', bloc.type, 'source', bloc.source, 'vignette', bloc.vignette, 'vignetteActivee', bloc.vignetteActivee, 'mediaExtra', bloc.mediaExtra, 'medias', bloc.medias, 'edition', bloc.edition, 'date', date, 'identifiant', bloc.identifiant, 'commentaires', commentaires, 'evaluations', evaluations, 'colonne', bloc.colonne, 'visibilite', bloc.visibilite, 'couleur', bloc.couleur)
										multi.zadd('blocs:' + id, indexBloc, blocId)
										if (parametres.commentaires === true) {
											for (const commentaire of bloc.listeCommentaires) {
												if (commentaire.hasOwnProperty('id') && commentaire.hasOwnProperty('identifiant') && commentaire.hasOwnProperty('date') && commentaire.hasOwnProperty('texte')) {
													multi.zadd('commentaires:' + blocId, commentaire.id, JSON.stringify(commentaire))
												}
											}
										}
										if (parametres.evaluations === true) {
											for (const evaluation of bloc.listeEvaluations) {
												if (evaluation.hasOwnProperty('id') && evaluation.hasOwnProperty('identifiant') && evaluation.hasOwnProperty('date') && evaluation.hasOwnProperty('etoiles')) {
													multi.zadd('evaluations:' + blocId, evaluation.id, JSON.stringify(evaluation))
												}
											}
										}
										multi.exec(async function () {
											if (bloc.hasOwnProperty('media') && bloc.media !== '' && bloc.type !== 'embed' && await fs.pathExists(path.normalize(cible + '/fichiers/' + bloc.media))) {
												await fs.copy(path.normalize(cible + '/fichiers/' + bloc.media), path.normalize(chemin + '/' + bloc.media, { overwrite: true }))
											}
											if (bloc.hasOwnProperty('mediaExtra') && bloc.mediaExtra !== '' && await fs.pathExists(path.normalize(cible + '/fichiers/' + bloc.mediaExtra))) {
												await fs.copy(path.normalize(cible + '/fichiers/' + bloc.mediaExtra), path.normalize(chemin + '/' + bloc.mediaExtra, { overwrite: true }))
											}
											if (bloc.hasOwnProperty('medias')) {
												const medias = JSON.parse(bloc.medias)
												for (let i = 0; i < medias.length; i++) {
													if (medias[i].hasOwnProperty('fichier') && medias[i].fichier !== '' && await fs.pathExists(path.normalize(cible + '/fichiers/' + medias[i].fichier))) {
														await fs.copy(path.normalize(cible + '/fichiers/' + medias[i].fichier), path.normalize(chemin + '/' + medias[i].fichier, { overwrite: true }))
													}
												}
											}
											if (bloc.hasOwnProperty('vignette') && bloc.vignette !== '' && bloc.vignette.substring(1, definirDossierFichiers(id).length + 1) === definirDossierFichiers(id) && await fs.pathExists(path.normalize(cible + '/fichiers/' + bloc.vignette.replace('/' + definirDossierFichiers(id) + '/' + id + '/', '')))) {
												await fs.copy(path.normalize(cible + '/fichiers/' + bloc.vignette.replace('/' + definirDossierFichiers(id) + '/' + id + '/', '')), path.normalize(chemin + '/' + bloc.vignette.replace('/' + definirDossierFichiers(id) + '/' + id + '/', ''), { overwrite: true }))
											}
											resolve({ bloc: bloc.bloc, blocId: blocId })
										})
									} else {
										resolve({ bloc: 0, blocId: 0 })
									}
								})
								donneesBlocs.push(donneesBloc)
							}
							Promise.all(donneesBlocs).then(async function (blocs) {
								const token = Math.random().toString(16).slice(10)
								const slug = definirSlug(donnees.mur.titre)
								const date = dayjs().format()
								const code = Math.floor(1000 + Math.random() * 9000)
								let activiteId = 0
								if (parametres.activite === true) {
									activiteId = donnees.mur.activite
								}
								if (!donnees.mur.fond.includes('/img/') && donnees.mur.fond.substring(0, 1) !== '#' && await fs.pathExists(path.normalize(cible + '/fichiers/' + donnees.mur.fond.split('/').pop()))) {
									await fs.copy(path.normalize(cible + '/fichiers/' + donnees.mur.fond.split('/').pop()), path.normalize(chemin + '/' + donnees.mur.fond.split('/').pop(), { overwrite: true }))
								}
								const multi = db.multi()
								multi.incr('mur')
								multi.hmset('murs:' + id, 'id', id, 'token', token, 'titre', donnees.mur.titre, 'identifiant', identifiant, 'fond', donnees.mur.fond, 'acces', donnees.mur.acces, 'motdepasseAdmin', '', 'code', code, 'contributions', donnees.mur.contributions, 'affichage', donnees.mur.affichage, 'registreActivite', donnees.mur.registreActivite, 'conversation', donnees.mur.conversation, 'listeUtilisateurs', donnees.mur.listeUtilisateurs, 'editionNom', donnees.mur.editionNom, 'fichiers', donnees.mur.fichiers, 'enregistrements', donnees.mur.enregistrements, 'liens', donnees.mur.liens, 'documents', donnees.mur.documents, 'commentaires', donnees.mur.commentaires, 'evaluations', donnees.mur.evaluations, 'verrouillage', donnees.mur.verrouillage, 'copieBloc', donnees.mur.copieBloc, 'ordre', donnees.mur.ordre, 'largeur', donnees.mur.largeur, 'date', date, 'colonnes', donnees.mur.colonnes, 'affichageColonnes', donnees.mur.affichageColonnes, 'bloc', donnees.mur.bloc, 'activite', activiteId, 'admins', JSON.stringify([]), 'vues', 0)
								multi.sadd('murs-crees:' + identifiant, id)
								multi.sadd('utilisateurs-murs:' + id, identifiant)
								if (parametres.activite === true) {
									if (parametres.commentaires === false) {
										donnees.activite = donnees.activite.filter(function (element) {
											return element.type !== 'bloc-commente'
										})
									}
									if (parametres.evaluations === false) {
										donnees.activite = donnees.activite.filter(function (element) {
											return element.type !== 'bloc-evalue'
										})
									}
									for (const activite of donnees.activite) {
										if (activite.hasOwnProperty('bloc') && activite.hasOwnProperty('identifiant') && activite.hasOwnProperty('titre') && activite.hasOwnProperty('date') && activite.hasOwnProperty('type') && activite.hasOwnProperty('id')) {
											blocs.forEach(function (item) {
												if (activite.bloc === item.bloc) {
													activite.bloc = item.blocId
												}
											})
											multi.zadd('activite:' + id, activite.id, JSON.stringify(activite))
										}
									}
								}
								multi.exec(async function () {
									await fs.remove(source)
									await fs.remove(cible)
									res.json({ id: id, token: token, slug: slug, titre: donnees.mur.titre, identifiant: identifiant, fond: donnees.mur.fond, acces: donnees.mur.acces, motdepasseAdmin: donnees.mur.motdepasseAdmin, code: code, contributions: donnees.mur.contributions, affichage: donnees.mur.affichage, registreActivite: donnees.mur.registreActivite, conversation: donnees.mur.conversation, listeUtilisateurs: donnees.mur.listeUtilisateurs, editionNom: donnees.mur.editionNom, fichiers: donnees.mur.fichiers, enregistrements: donnees.mur.enregistrements, liens: donnees.mur.liens, documents: donnees.mur.documents, commentaires: donnees.mur.commentaires, evaluations: donnees.mur.evaluations, verrouillage: donnees.mur.verrouillage, copieBloc: donnees.mur.copieBloc, ordre: donnees.mur.ordre, largeur: donnees.mur.largeur, date: date, colonnes: donnees.mur.colonnes, affichageColonnes: donnees.mur.affichageColonnes, bloc: donnees.mur.bloc, activite: activiteId, admins: [], vues: 0 })
								})
							})
						})
					} else {
						await fs.remove(source)
						await fs.remove(cible)
						res.send('donnees_corrompues')
					}
				} catch (err) {
					await fs.remove(path.join(__dirname, '..', '/static/temp/' + req.file.filename))
					res.send('erreur_import')
				}
			})
		}
	})

	app.post('/api/importer-mur-sans-compte', function (req, res) {
		if (maintenance === true) {
			res.redirect('/maintenance')
			return false
		}
		const identifiant = req.session.identifiant
		if (!identifiant) {
			res.send('non_connecte')
		} else {
			televerserTemp(req, res, async function (err) {
				if (err) { res.send('erreur_import'); return false }
				try {
					const source = path.join(__dirname, '..', '/static/temp/' + req.file.filename)
					const cible = path.join(__dirname, '..', '/static/temp/archive-' + Math.floor((Math.random() * 100000) + 1))
					await extract(source, { dir: cible })
					const donnees = await fs.readJson(path.normalize(cible + '/donnees.json'))
					const parametres = JSON.parse(req.body.parametres)
					// Vérification des clés des données
					if (donnees.hasOwnProperty('mur') && donnees.hasOwnProperty('blocs') && donnees.hasOwnProperty('activite') && donnees.mur.hasOwnProperty('id') && donnees.mur.hasOwnProperty('token') && donnees.mur.hasOwnProperty('titre') && donnees.mur.hasOwnProperty('identifiant') && donnees.mur.hasOwnProperty('fond') && donnees.mur.hasOwnProperty('acces') && donnees.mur.hasOwnProperty('motdepasseAdmin') && donnees.mur.hasOwnProperty('contributions') && donnees.mur.hasOwnProperty('affichage') && donnees.mur.hasOwnProperty('registreActivite') && donnees.mur.hasOwnProperty('conversation') && donnees.mur.hasOwnProperty('listeUtilisateurs') && donnees.mur.hasOwnProperty('editionNom') && donnees.mur.hasOwnProperty('enregistrements') && donnees.mur.hasOwnProperty('ordre') && donnees.mur.hasOwnProperty('largeur') && donnees.mur.hasOwnProperty('affichageColonnes') && donnees.mur.hasOwnProperty('vues') && donnees.mur.hasOwnProperty('fichiers') && donnees.mur.hasOwnProperty('liens') && donnees.mur.hasOwnProperty('documents') && donnees.mur.hasOwnProperty('commentaires') && donnees.mur.hasOwnProperty('evaluations') && donnees.mur.hasOwnProperty('verrouillage') && donnees.mur.hasOwnProperty('copieBloc') && donnees.mur.hasOwnProperty('date') && donnees.mur.hasOwnProperty('colonnes') && donnees.mur.hasOwnProperty('bloc') && donnees.mur.hasOwnProperty('activite')) {
						const id = req.body.mur
						if (parametres.contenu === 'remplacer') {
							db.zrange('blocs:' + id, 0, -1, function (err, blocs) {
								if (err) { res.send('erreur_import'); return false }
								// Supprimer données actuelles du mur
								const multi = db.multi()
								for (let i = 0; i < blocs.length; i++) {
									multi.del('commentaires:' + blocs[i])
									multi.del('evaluations:' + blocs[i])
									multi.del('contenu-blocs:' + id + ':' + blocs[i])
								}
								multi.del('blocs:' + id)
								multi.del('activite:' + id)
								multi.del('dates-murs:' + id)
								multi.exec(async function () {
									const chemin = path.join(__dirname, '..', '/static/' + definirDossierFichiers(id) + '/' + id)
									await fs.emptyDir(chemin)
									const donneesBlocs = []
									for (const [indexBloc, bloc] of donnees.blocs.entries()) {
										const donneesBloc = new Promise(function (resolve) {
											if (bloc.hasOwnProperty('id') && bloc.hasOwnProperty('bloc') && bloc.hasOwnProperty('typeBloc') && bloc.hasOwnProperty('titre') && bloc.hasOwnProperty('texte') && bloc.hasOwnProperty('media') && bloc.hasOwnProperty('iframe') && bloc.hasOwnProperty('type') && bloc.hasOwnProperty('source') && bloc.hasOwnProperty('vignette') && bloc.hasOwnProperty('vignetteActivee') && bloc.hasOwnProperty('mediaExtra') && bloc.hasOwnProperty('medias') && bloc.hasOwnProperty('edition') && bloc.hasOwnProperty('identifiant') && bloc.hasOwnProperty('commentaires') && bloc.hasOwnProperty('evaluations') && bloc.hasOwnProperty('colonne') && bloc.hasOwnProperty('visibilite') && bloc.hasOwnProperty('couleur') && bloc.hasOwnProperty('listeCommentaires') && bloc.hasOwnProperty('listeEvaluations')) {
												const date = dayjs().format()
												let commentaires = 0
												let evaluations = 0
												if (parametres.commentaires === true) {
													commentaires = bloc.commentaires
												}
												if (parametres.evaluations === true) {
													evaluations = bloc.evaluations
												}
												if (bloc.vignette !== '') {
													bloc.vignette = bloc.vignette.replace('/' + definirDossierFichiers(donnees.mur.id) + '/' + donnees.mur.id, '/' + definirDossierFichiers(id) + '/' + id)
												}
												const multi = db.multi()
												const blocId = 'bloc-id-' + (new Date()).getTime() + Math.random().toString(16).slice(10)
												multi.hmset('contenu-blocs:' + id + ':' + blocId, 'id', bloc.id, 'bloc', blocId, 'typeBloc', bloc.typeBloc, 'titre', bloc.titre, 'texte', bloc.texte, 'media', bloc.media, 'iframe', bloc.iframe, 'type', bloc.type, 'source', bloc.source, 'vignette', bloc.vignette, 'vignetteActivee', bloc.vignetteActivee, 'mediaExtra', bloc.mediaExtra, 'medias', bloc.medias, 'edition', bloc.edition, 'date', date, 'identifiant', bloc.identifiant, 'commentaires', commentaires, 'evaluations', evaluations, 'colonne', bloc.colonne, 'visibilite', bloc.visibilite, 'couleur', bloc.couleur)
												multi.zadd('blocs:' + id, indexBloc, blocId)
												if (parametres.commentaires === true) {
													for (const commentaire of bloc.listeCommentaires) {
														if (commentaire.hasOwnProperty('id') && commentaire.hasOwnProperty('identifiant') && commentaire.hasOwnProperty('date') && commentaire.hasOwnProperty('texte')) {
															multi.zadd('commentaires:' + blocId, commentaire.id, JSON.stringify(commentaire))
														}
													}
												}
												if (parametres.evaluations === true) {
													for (const evaluation of bloc.listeEvaluations) {
														if (evaluation.hasOwnProperty('id') && evaluation.hasOwnProperty('identifiant') && evaluation.hasOwnProperty('date') && evaluation.hasOwnProperty('etoiles')) {
															multi.zadd('evaluations:' + blocId, evaluation.id, JSON.stringify(evaluation))
														}
													}
												}
												multi.exec(async function () {
													if (bloc.hasOwnProperty('media') && bloc.media !== '' && bloc.type !== 'embed' && await fs.pathExists(path.normalize(cible + '/fichiers/' + bloc.media))) {
														await fs.copy(path.normalize(cible + '/fichiers/' + bloc.media), path.normalize(chemin + '/' + bloc.media, { overwrite: true }))
													}
													if (bloc.hasOwnProperty('mediaExtra') && bloc.mediaExtra !== '' && await fs.pathExists(path.normalize(cible + '/fichiers/' + bloc.mediaExtra))) {
														await fs.copy(path.normalize(cible + '/fichiers/' + bloc.mediaExtra), path.normalize(chemin + '/' + bloc.mediaExtra, { overwrite: true }))
													}
													if (bloc.hasOwnProperty('medias')) {
														const medias = JSON.parse(bloc.medias)
														for (let i = 0; i < medias.length; i++) {
															if (medias[i].hasOwnProperty('fichier') && medias[i].fichier !== '' && await fs.pathExists(path.normalize(cible + '/fichiers/' + medias[i].fichier))) {
																await fs.copy(path.normalize(cible + '/fichiers/' + medias[i].fichier), path.normalize(chemin + '/' + medias[i].fichier, { overwrite: true }))
															}
														}
													}
													if (bloc.hasOwnProperty('vignette') && bloc.vignette !== '' && bloc.vignette.substring(1, definirDossierFichiers(id).length + 1) === definirDossierFichiers(id) && await fs.pathExists(path.normalize(cible + '/fichiers/' + bloc.vignette.replace('/' + definirDossierFichiers(id) + '/' + id + '/', '')))) {
														await fs.copy(path.normalize(cible + '/fichiers/' + bloc.vignette.replace('/' + definirDossierFichiers(id) + '/' + id + '/', '')), path.normalize(chemin + '/' + bloc.vignette.replace('/' + definirDossierFichiers(id) + '/' + id + '/', ''), { overwrite: true }))
													}
													resolve({ bloc: bloc.bloc, blocId: blocId })
												})
											} else {
												resolve({ bloc: 0, blocId: 0 })
											}
										})
										donneesBlocs.push(donneesBloc)
									}
									Promise.all(donneesBlocs).then(async function (blocsCrees) {
										const slug = definirSlug(donnees.mur.titre)
										const date = dayjs().format()
										const code = Math.floor(1000 + Math.random() * 9000)
										let activiteId = 0
										if (parametres.activite === true) {
											activiteId = donnees.mur.activite
										}
										if (!donnees.mur.fond.includes('/img/') && donnees.mur.fond.substring(0, 1) !== '#' && await fs.pathExists(path.normalize(cible + '/fichiers/' + donnees.mur.fond.split('/').pop()))) {
											await fs.copy(path.normalize(cible + '/fichiers/' + donnees.mur.fond.split('/').pop()), path.normalize(chemin + '/' + donnees.mur.fond.split('/').pop(), { overwrite: true }))
										}
										const multi = db.multi()
										multi.hmset('murs:' + id, 'titre', donnees.mur.titre, 'identifiant', identifiant, 'fond', donnees.mur.fond, 'acces', donnees.mur.acces, 'motdepasseAdmin', '', 'code', code, 'contributions', donnees.mur.contributions, 'affichage', donnees.mur.affichage, 'registreActivite', donnees.mur.registreActivite, 'conversation', donnees.mur.conversation, 'listeUtilisateurs', donnees.mur.listeUtilisateurs, 'editionNom', donnees.mur.editionNom, 'fichiers', donnees.mur.fichiers, 'enregistrements', donnees.mur.enregistrements, 'liens', donnees.mur.liens, 'documents', donnees.mur.documents, 'commentaires', donnees.mur.commentaires, 'evaluations', donnees.mur.evaluations, 'verrouillage', donnees.mur.verrouillage, 'copieBloc', donnees.mur.copieBloc, 'ordre', donnees.mur.ordre, 'largeur', donnees.mur.largeur, 'date', date, 'colonnes', donnees.mur.colonnes, 'affichageColonnes', donnees.mur.affichageColonnes, 'bloc', donnees.mur.bloc, 'activite', activiteId)
										if (parametres.activite === true) {
											if (parametres.commentaires === false) {
												donnees.activite = donnees.activite.filter(function (element) {
													return element.type !== 'bloc-commente'
												})
											}
											if (parametres.evaluations === false) {
												donnees.activite = donnees.activite.filter(function (element) {
													return element.type !== 'bloc-evalue'
												})
											}
											for (const activite of donnees.activite) {
												if (activite.hasOwnProperty('bloc') && activite.hasOwnProperty('identifiant') && activite.hasOwnProperty('titre') && activite.hasOwnProperty('date') && activite.hasOwnProperty('type') && activite.hasOwnProperty('id')) {
													blocsCrees.forEach(function (item) {
														if (activite.bloc === item.bloc) {
															activite.bloc = item.blocId
														}
													})
													multi.zadd('activite:' + id, activite.id, JSON.stringify(activite))
												}
											}
										}
										multi.exec(async function () {
											await fs.remove(source)
											await fs.remove(cible)
											res.send(slug)
										})
									})
								})
							})
						} else {
							db.hgetall('murs:' + id, async function (err, donneesMur) {
								if (err) { res.send('erreur_import'); return false }
								const chemin = path.join(__dirname, '..', '/static/' + definirDossierFichiers(id) + '/' + id)
								await fs.emptyDir(chemin)
								const donneesBlocs = []
								for (const [indexBloc, bloc] of donnees.blocs.entries()) {
									const donneesBloc = new Promise(function (resolve) {
										if (bloc.hasOwnProperty('id') && bloc.hasOwnProperty('bloc') && bloc.hasOwnProperty('typeBloc') && bloc.hasOwnProperty('titre') && bloc.hasOwnProperty('texte') && bloc.hasOwnProperty('media') && bloc.hasOwnProperty('iframe') && bloc.hasOwnProperty('type') && bloc.hasOwnProperty('source') && bloc.hasOwnProperty('vignette') && bloc.hasOwnProperty('vignetteActivee') && bloc.hasOwnProperty('mediaExtra') && bloc.hasOwnProperty('medias') && bloc.hasOwnProperty('edition') && bloc.hasOwnProperty('identifiant') && bloc.hasOwnProperty('commentaires') && bloc.hasOwnProperty('evaluations') && bloc.hasOwnProperty('colonne') && bloc.hasOwnProperty('visibilite') && bloc.hasOwnProperty('couleur') && bloc.hasOwnProperty('listeCommentaires') && bloc.hasOwnProperty('listeEvaluations')) {
											const deltaColonne = JSON.parse(donneesMur.colonnes).length
											const colonne = (parseInt(bloc.colonne)) + deltaColonne
											const date = dayjs().format()
											let commentaires = 0
											let evaluations = 0
											if (parametres.commentaires === true) {
												commentaires = bloc.commentaires
											}
											if (parametres.evaluations === true) {
												evaluations = bloc.evaluations
											}
											if (bloc.vignette !== '') {
												bloc.vignette = bloc.vignette.replace('/' + definirDossierFichiers(donnees.mur.id) + '/' + donnees.mur.id, '/' + definirDossierFichiers(id) + '/' + id)
											}
											const multi = db.multi()
											const blocId = 'bloc-id-' + (new Date()).getTime() + Math.random().toString(16).slice(10)
											multi.hmset('contenu-blocs:' + id + ':' + blocId, 'id', bloc.id, 'bloc', blocId, 'typeBloc', bloc.typeBloc, 'titre', bloc.titre, 'texte', bloc.texte, 'media', bloc.media, 'iframe', bloc.iframe, 'type', bloc.type, 'source', bloc.source, 'vignette', bloc.vignette, 'vignetteActivee', bloc.vignetteActivee, 'mediaExtra', bloc.mediaExtra, 'medias', bloc.medias, 'edition', bloc.edition, 'date', date, 'identifiant', bloc.identifiant, 'commentaires', commentaires, 'evaluations', evaluations, 'colonne', colonne, 'visibilite', bloc.visibilite, 'couleur', bloc.couleur)
											multi.zadd('blocs:' + id, indexBloc, blocId)
											if (parametres.commentaires === true) {
												for (const commentaire of bloc.listeCommentaires) {
													if (commentaire.hasOwnProperty('id') && commentaire.hasOwnProperty('identifiant') && commentaire.hasOwnProperty('date') && commentaire.hasOwnProperty('texte')) {
														multi.zadd('commentaires:' + blocId, commentaire.id, JSON.stringify(commentaire))
													}
												}
											}
											if (parametres.evaluations === true) {
												for (const evaluation of bloc.listeEvaluations) {
													if (evaluation.hasOwnProperty('id') && evaluation.hasOwnProperty('identifiant') && evaluation.hasOwnProperty('date') && evaluation.hasOwnProperty('etoiles')) {
														multi.zadd('evaluations:' + blocId, evaluation.id, JSON.stringify(evaluation))
													}
												}
											}
											multi.exec(async function () {
												if (bloc.hasOwnProperty('media') && bloc.media !== '' && bloc.type !== 'embed' && await fs.pathExists(path.normalize(cible + '/fichiers/' + bloc.media))) {
													await fs.copy(path.normalize(cible + '/fichiers/' + bloc.media), path.normalize(chemin + '/' + bloc.media, { overwrite: true }))
												}
												if (bloc.hasOwnProperty('mediaExtra') && bloc.mediaExtra !== '' && await fs.pathExists(path.normalize(cible + '/fichiers/' + bloc.mediaExtra))) {
													await fs.copy(path.normalize(cible + '/fichiers/' + bloc.mediaExtra), path.normalize(chemin + '/' + bloc.mediaExtra, { overwrite: true }))
												}
												if (bloc.hasOwnProperty('medias')) {
													const medias = JSON.parse(bloc.medias)
													for (let i = 0; i < medias.length; i++) {
														if (medias[i].hasOwnProperty('fichier') && medias[i].fichier !== '' && await fs.pathExists(path.normalize(cible + '/fichiers/' + medias[i].fichier))) {
															await fs.copy(path.normalize(cible + '/fichiers/' + medias[i].fichier), path.normalize(chemin + '/' + medias[i].fichier, { overwrite: true }))
														}
													}
												}
												if (bloc.hasOwnProperty('vignette') && bloc.vignette !== '' && bloc.vignette.substring(1, definirDossierFichiers(id).length + 1) === definirDossierFichiers(id) && await fs.pathExists(path.normalize(cible + '/fichiers/' + bloc.vignette.replace('/' + definirDossierFichiers(id) + '/' + id + '/', '')))) {
													await fs.copy(path.normalize(cible + '/fichiers/' + bloc.vignette.replace('/' + definirDossierFichiers(id) + '/' + id + '/', '')), path.normalize(chemin + '/' + bloc.vignette.replace('/' + definirDossierFichiers(id) + '/' + id + '/', ''), { overwrite: true }))
												}
												resolve({ bloc: bloc.bloc, blocId: blocId })
											})
										} else {
											resolve({ bloc: 0, blocId: 0 })
										}
									})
									donneesBlocs.push(donneesBloc)
								}
								Promise.all(donneesBlocs).then(function (blocsCrees) {
									const slug = definirSlug(donneesMur.titre)
									let activiteId = parseInt(donneesMur.activite)
									if (parametres.activite === true) {
										activiteId = activiteId + donnees.mur.activite
									}
									let blocNum = parseInt(donneesMur.bloc)
									blocNum  = blocNum  + donnees.mur.bloc
									let colonnes = JSON.parse(donneesMur.colonnes)
									colonnes = colonnes.concat(JSON.parse(donnees.mur.colonnes))
									let affichageColonnes = JSON.parse(donneesMur.affichageColonnes)
									affichageColonnes = affichageColonnes.concat(JSON.parse(donnees.mur.affichageColonnes))
									const multi = db.multi()
									multi.hmset('murs:' + id, 'identifiant', identifiant, 'colonnes', JSON.stringify(colonnes), 'affichageColonnes', JSON.stringify(affichageColonnes), 'bloc', blocNum, 'activite', activiteId)
									if (parametres.activite === true) {
										if (parametres.commentaires === false) {
											donnees.activite = donnees.activite.filter(function (element) {
												return element.type !== 'bloc-commente'
											})
										}
										if (parametres.evaluations === false) {
											donnees.activite = donnees.activite.filter(function (element) {
												return element.type !== 'bloc-evalue'
											})
										}
										for (const activite of donnees.activite) {
											if (activite.hasOwnProperty('bloc') && activite.hasOwnProperty('identifiant') && activite.hasOwnProperty('titre') && activite.hasOwnProperty('date') && activite.hasOwnProperty('type') && activite.hasOwnProperty('id')) {
												blocsCrees.forEach(function (item) {
													if (activite.bloc === item.bloc) {
														activite.bloc = item.blocId
													}
												})
												multi.zadd('activite:' + id, activite.id, JSON.stringify(activite))
											}
										}
									}
									multi.exec(async function () {
										await fs.remove(source)
										await fs.remove(cible)
										res.send(slug)
									})
								})
							})
						}
					} else {
						await fs.remove(source)
						await fs.remove(cible)
						res.send('donnees_corrompues')
					}
				} catch (err) {
					await fs.remove(path.join(__dirname, '..', '/static/temp/' + req.file.filename))
					res.send('erreur_import')
				}
			})
		}
	})

	app.post('/api/supprimer-mur', function (req, res) {
		if (maintenance === true) {
			res.redirect('/maintenance')
			return false
		}
		const identifiant = req.body.identifiant
		const admin = req.body.admin
		const motdepasseAdmin = process.env.VITE_ADMIN_PASSWORD
		if ((req.session.identifiant && req.session.identifiant === identifiant) || (admin !== '' && admin === motdepasseAdmin)) {
			const mur = req.body.murId
			const type = req.body.type
			let suppressionFichiers = true
			if (req.body.hasOwnProperty('suppressionFichiers')) {
				suppressionFichiers = req.body.suppressionFichiers
			}
			db.exists('murs:' + mur, async function (err, resultat) {
				if (err) { res.send('erreur_suppression'); return false }
				if (resultat === 1) {
					db.hgetall('murs:' + mur, function (err, donneesMur) {
						if (err) { res.send('erreur_suppression'); return false }
						if (donneesMur.identifiant === identifiant) {
							db.zrange('blocs:' + mur, 0, -1, function (err, blocs) {
								if (err) { res.send('erreur_suppression'); return false }
								const multi = db.multi()
								for (let i = 0; i < blocs.length; i++) {
									multi.del('commentaires:' + blocs[i])
									multi.del('evaluations:' + blocs[i])
									multi.del('contenu-blocs:' + mur + ':' + blocs[i])
								}
								multi.del('blocs:' + mur)
								multi.del('murs:' + mur)
								multi.del('activite:' + mur)
								multi.del('dates-murs:' + mur)
								multi.srem('murs-crees:' + identifiant, mur)
								multi.smembers('utilisateurs-murs:' + mur, function (err, utilisateurs) {
									if (err) { res.send('erreur_suppression'); return false }
									for (let j = 0; j < utilisateurs.length; j++) {
										db.srem('murs-rejoints:' + utilisateurs[j], mur)
										db.srem('murs-utilisateurs:' + utilisateurs[j], mur)
										db.srem('murs-admins:' + utilisateurs[j], mur)
										db.srem('murs-favoris:' + utilisateurs[j], mur)
									}
								})
								multi.del('utilisateurs-murs:' + mur)
								multi.exec(async function () {
									const chemin = path.join(__dirname, '..', '/static/' + definirDossierFichiers(mur) + '/' + mur)
									if (suppressionFichiers === true) {
										await fs.remove(chemin)
									}
									res.send('mur_supprime')
								})
							})
						} else {
							db.hgetall('utilisateurs:' + identifiant, function (err, donnees) {
								if (err) { res.send('erreur_suppression'); return false }
								const multi = db.multi()
								if (donnees.hasOwnProperty('dossiers')) {
									const dossiers = JSON.parse(donnees.dossiers)
									dossiers.forEach(function (dossier, indexDossier) {
										if (dossier.murs.includes(mur)) {
											const indexMur = dossier.murs.indexOf(mur)
											dossiers[indexDossier].murs.splice(indexMur, 1)
										}
									})
									multi.hset('utilisateurs:' + identifiant, 'dossiers', JSON.stringify(dossiers))
								}
								if (type === 'mur-rejoint') {
									multi.srem('murs-rejoints:' + identifiant, mur)
								}
								if (type === 'mur-admin') {
									multi.srem('murs-rejoints:' + identifiant, mur)
									multi.srem('murs-admins:' + identifiant, mur)
								}
								multi.srem('murs-favoris:' + identifiant, mur)
								multi.exec(function () {
									// Suppression de l'utilisateur dans la liste des admins du mur
									if (type === 'murs-admin') {
										db.hgetall('murs:' + mur, function (err, donnees) {
											if (!err && donnees) {
												let listeAdmins = []
												if (donnees.hasOwnProperty('admins')) {
													listeAdmins = JSON.parse(donnees.admins)
												}
												if (listeAdmins.includes(identifiant)) {
													const index = listeAdmins.indexOf(identifiant)
													listeAdmins.splice(index, 1)
												}
												db.hset('murs:' + mur, 'admins', JSON.stringify(listeAdmins), function () {
													res.send('mur_supprime')
												})
											} else {
												res.send('mur_supprime')
											}
										})
									} else {
										res.send('mur_supprime')
									}
								})
							})
						}
					})
				} else if (resultat !== 1 && await fs.pathExists(path.join(__dirname, '..', '/static/murs/mur-' + mur + '.json'))) {
					const donneesMur = await fs.readJson(path.join(__dirname, '..', '/static/murs/mur-' + mur + '.json'))
					if (typeof donneesMur === 'object' && donneesMur !== null) {
						const multi = db.multi()
						if (donneesMur.identifiant === identifiant) {
							multi.srem('murs-crees:' + identifiant, mur)
							multi.smembers('utilisateurs-murs:' + mur, function (err, utilisateurs) {
								if (err) { res.send('erreur_suppression'); return false }
								for (let j = 0; j < utilisateurs.length; j++) {
									db.srem('murs-rejoints:' + utilisateurs[j], mur)
									db.srem('murs-utilisateurs:' + utilisateurs[j], mur)
									db.srem('murs-admins:' + utilisateurs[j], mur)
									db.srem('murs-favoris:' + utilisateurs[j], mur)
								}
							})
							multi.del('utilisateurs-murs:' + mur)
							multi.exec(async function () {
								if (suppressionFichiers === true) {
									await fs.remove(path.join(__dirname, '..', '/static/' + definirDossierFichiers(mur) + '/' + mur))
								}
								await fs.remove(path.join(__dirname, '..', '/static/murs/' + mur + '.json'))
								await fs.remove(path.join(__dirname, '..', '/static/murs/mur-' + mur + '.json'))
								res.send('mur_supprime')
							})
						} else {
							db.hgetall('utilisateurs:' + identifiant, function (err, donnees) {
								if (err) { res.send('erreur_suppression'); return false }
								if (donnees.hasOwnProperty('dossiers')) {
									const dossiers = JSON.parse(donnees.dossiers)
									dossiers.forEach(function (dossier, indexDossier) {
										if (dossier.murs.includes(mur)) {
											const indexMur = dossier.murs.indexOf(mur)
											dossiers[indexDossier].murs.splice(indexMur, 1)
										}
									})
									multi.hset('utilisateurs:' + identifiant, 'dossiers', JSON.stringify(dossiers))
								}
								if (type === 'mur-rejoint') {
									multi.srem('murs-rejoints:' + identifiant, mur)
								}
								if (type === 'mur-admin') {
									multi.srem('murs-rejoints:' + identifiant, mur)
									multi.srem('murs-admins:' + identifiant, mur)
								}
								multi.srem('murs-favoris:' + identifiant, mur)
								multi.exec(function () {
									// Suppression de l'utilisateur dans la liste des admins du mur
									if (type === 'mur-admin') {
										db.hgetall('murs:' + mur, function (err, donnees) {
											let listeAdmins = []
											if (donnees.hasOwnProperty('admins')) {
												listeAdmins = JSON.parse(donnees.admins)
											}
											if (listeAdmins.includes(identifiant)) {
												const index = listeAdmins.indexOf(identifiant)
												listeAdmins.splice(index, 1)
											}
											db.hset('murs:' + mur, 'admins', JSON.stringify(listeAdmins), function () {
												res.send('mur_supprime')
											})
										})
									} else {
										res.send('mur_supprime')
									}
								})
							})
						}
					} else {
						res.send('erreur_suppression')
					}
				}
			})
		} else {
			res.send('non_connecte')
		}
	})

	app.post('/api/modifier-informations', function (req, res) {
		const identifiant = req.body.identifiant
		if (req.session.identifiant && req.session.identifiant === identifiant) {
			const nom = req.body.nom
			const email = req.body.email
			db.hmset('utilisateurs:' + identifiant, 'nom', nom, 'email', email)
			req.session.nom = nom
			req.session.email = email
			res.send('utilisateur_modifie')
		} else {
			res.send('non_connecte')
		}
	})

	app.post('/api/modifier-mot-de-passe', function (req, res) {
		const identifiant = req.body.identifiant
		if (req.session.identifiant && req.session.identifiant === identifiant) {
			db.hgetall('utilisateurs:' + identifiant, async function (err, donnees) {
				if (err) { res.send('erreur'); return false }
				if (await bcrypt.compare(req.body.motdepasse, donnees.motdepasse)) {
					const hash = await bcrypt.hash(req.body.nouveaumotdepasse, 10)
					db.hset('utilisateurs:' + identifiant, 'motdepasse', hash)
					res.send('motdepasse_modifie')
				} else {
					res.send('motdepasse_incorrect')
				}
			})
		} else {
			res.send('non_connecte')
		}
	})

	app.post('/api/modifier-mot-de-passe-admin', function (req, res) {
		const admin = req.body.admin
		if (admin !== '' && admin === process.env.VITE_ADMIN_PASSWORD) {
			const identifiant = req.body.identifiant
			const email = req.body.email
			if (identifiant !== '') {
				db.exists('utilisateurs:' + identifiant, async function (err, resultat) {
					if (err) { res.send('erreur'); return false }
					if (resultat === 1) {
						const hash = await bcrypt.hash(req.body.motdepasse, 10)
						db.hset('utilisateurs:' + identifiant, 'motdepasse', hash)
						res.send('motdepasse_modifie')
					} else {
						res.send('identifiant_non_valide')
					}
				})
			} else if (email !== '') {
				db.keys('utilisateurs:*', function (err, utilisateurs) {
					if (utilisateurs !== null) {
						const donneesUtilisateurs = []
						utilisateurs.forEach(function (utilisateur) {
							const donneesUtilisateur = new Promise(function (resolve) {
								db.hgetall('utilisateurs:' + utilisateur.substring(13), function (err, donnees) {
									if (err) { resolve({}) }
									if (donnees.hasOwnProperty('email')) {
										resolve({ identifiant: utilisateur.substring(13), email: donnees.email })
									} else {
										resolve({})
									}
								})
							})
							donneesUtilisateurs.push(donneesUtilisateur)
						})
						Promise.all(donneesUtilisateurs).then(async function (donnees) {
							let utilisateurId = ''
							donnees.forEach(function (utilisateur) {
								if (utilisateur.hasOwnProperty('email') && utilisateur.email.toLowerCase() === email.toLowerCase()) {
									utilisateurId = utilisateur.identifiant
								}
							})
							if (utilisateurId !== '') {
								const hash = await bcrypt.hash(req.body.motdepasse, 10)
								db.hset('utilisateurs:' + utilisateurId, 'motdepasse', hash)
								res.send(utilisateurId)
							} else {
								res.send('email_non_valide')
							}
						})
					}
				})
			}
		}
	})

	app.post('/api/recuperer-donnees-mur-admin', function (req, res) {
		const mur = req.body.murId
		db.exists('murs:' + mur, async function (err, resultat) {
			if (err) { res.send('erreur'); return false }
			if (resultat === 1) {
				db.hgetall('murs:' + mur, function (err, donneesMur) {
					if (err) { res.send('erreur'); return false }
					res.json(donneesMur)
				})
			} else if (resultat !== 1 && await fs.pathExists(path.join(__dirname, '..', '/static/murs/mur-' + mur + '.json'))) {
				const donnees = await fs.readJson(path.join(__dirname, '..', '/static/murs/mur-' + mur + '.json'))
				if (typeof donnees === 'object' && donnees !== null) {
					res.json(donnees)
				} else {
					res.send('erreur')
				}
			} else {
				res.send('mur_inexistant')
			}
		})
	})

	app.post('/api/recuperer-donnees-utilisateur-admin', function (req, res) {
		const identifiant = req.body.identifiant
		db.exists('utilisateurs:' + identifiant, function (err, resultat) {
			if (err) { res.send('erreur'); return false }
			if (resultat === 1) {
				db.hgetall('utilisateurs:' + identifiant, function (err, donneesUtilisateur) {
					if (err) { res.send('erreur'); return false }
					res.json(donneesUtilisateur)
				})
			} else {
				res.send('utilisateur_inexistant')
			}
		})
	})

	app.post('/api/modifier-donnees-mur-admin', function (req, res) {
		const mur = req.body.murId
		const champ = req.body.champ
		const valeur = req.body.valeur
		db.exists('murs:' + mur, async function (err, resultat) {
			if (err) { res.send('erreur'); return false }
			if (resultat === 1) {
				if (champ === 'motdepasse') {
					const hash = await bcrypt.hash(valeur, 10)
					db.hset('murs:' + mur, champ, hash)
				} else if (champ === 'code') {
					db.hset('murs:' + mur, champ, parseInt(valeur))
				} else {
					db.hset('murs:' + mur, champ, valeur)
				}
				res.send('donnees_modifiees')
			} else {
				res.send('mur_inexistant')
			}
		})
	})

	app.post('/api/supprimer-compte', function (req, res) {
		if (maintenance === true) {
			res.redirect('/maintenance')
			return false
		}
		const identifiant = req.body.identifiant
		const admin = req.body.admin
		const motdepasseAdmin = process.env.VITE_ADMIN_PASSWORD
		let type = 'utilisateur'
		if ((req.session.identifiant && req.session.identifiant === identifiant) || (admin !== '' && admin === motdepasseAdmin)) {
			if (admin === motdepasseAdmin) {
				type === 'admin'
			}
			db.smembers('murs-crees:' + identifiant, function (err, murs) {
				if (err) { res.send('erreur'); return false }
				const donneesMurs = []
				for (const mur of murs) {
					const donneesMur = new Promise(function (resolve) {
						db.exists('murs:' + mur, async function (err, resultat) {
							if (err) { resolve() }
							if (resultat === 1) {
								db.zrange('blocs:' + mur, 0, -1, function (err, blocs) {
									if (err) { resolve() }
									const multi = db.multi()
									for (let i = 0; i < blocs.length; i++) {
										multi.del('commentaires:' + blocs[i])
										multi.del('evaluations:' + blocs[i])
										multi.del('contenu-blocs:' + mur + ':' + blocs[i])
									}
									multi.del('blocs:' + mur)
									multi.del('murs:' + mur)
									multi.del('activite:' + mur)
									multi.del('dates-murs:' + mur)
									multi.smembers('utilisateurs-murs:' + mur, function (err, utilisateurs) {
										if (err) { resolve() }
										for (let j = 0; j < utilisateurs.length; j++) {
											db.srem('murs-rejoints:' + utilisateurs[j], mur)
											db.srem('murs-utilisateurs:' + utilisateurs[j], mur)
											db.srem('murs-admins:' + utilisateurs[j], mur)
											db.srem('murs-favoris:' + utilisateurs[j], mur)
										}
									})
									multi.del('utilisateurs-murs:' + mur)
									multi.exec(async function () {
										const chemin = path.join(__dirname, '..', '/static/' + definirDossierFichiers(mur) + '/' + mur)
										await fs.remove(chemin)
										resolve(mur)
									})
								})
							} else if (resultat !== 1 && await fs.pathExists(path.join(__dirname, '..', '/static/murs/' + mur + '.json'))) {
								const multi = db.multi()
								multi.smembers('utilisateurs-murs:' + mur, function (err, utilisateurs) {
									if (err) { resolve() }
									for (let j = 0; j < utilisateurs.length; j++) {
										db.srem('murs-rejoints:' + utilisateurs[j], mur)
										db.srem('murs-utilisateurs:' + utilisateurs[j], mur)
										db.srem('murs-admins:' + utilisateurs[j], mur)
										db.srem('murs-favoris:' + utilisateurs[j], mur)
									}
								})
								multi.del('utilisateurs-murs:' + mur)
								multi.exec(async function () {
									await fs.remove(path.join(__dirname, '..', '/static/' + definirDossierFichiers(mur) + '/' + mur))
									await fs.remove(path.join(__dirname, '..', '/static/murs/' + mur + '.json'))
									await fs.remove(path.join(__dirname, '..', '/static/murs/mur-' + mur + '.json'))
									resolve(mur)
								})
							} else {
								resolve()
							}
						})
					})
					donneesMurs.push(donneesMur)
				}
				Promise.all(donneesMurs).then(function () {
					db.smembers('murs-utilisateurs:' + identifiant, function (err, murs) {
						if (err) { res.send('erreur'); return false }
						const donneesBlocs = []
						const donneesActivites = []
						const donneesCommentaires = []
						const donneesEvaluations = []
						for (const mur of murs) {
							db.exists('murs:' + mur, async function (err, resultat) {
								if (resultat === 1) {
									const donneesBloc = new Promise(function (resolve) {
										db.zrange('blocs:' + mur, 0, -1, function (err, blocs) {
											if (err) { resolve() }
											for (let i = 0; i < blocs.length; i++) {
												db.hgetall('contenu-blocs:' + mur + ':' + blocs[i], function (err, donnees) {
													if (err) { resolve() }
													if (donnees.identifiant === identifiant) {
														if (donnees.hasOwnProperty('media') && donnees.media !== '' && donnees.type !== 'embed') {
															supprimerFichier(mur, donnees.media)
														}
														if (donnees.hasOwnProperty('mediaExtra') && donnees.mediaExtra !== '') {
															supprimerFichier(mur, donnees.mediaExtra)
														}
														if (donnees.hasOwnProperty('medias')) {
															const medias = JSON.parse(donnees.medias)
															for (let i = 0; i < medias.length; i++) {
																if (medias[i].hasOwnProperty('fichier')) {
																	supprimerFichier(mur, medias[i].fichier)
																}
															}
														}
														if (donnees.hasOwnProperty('vignette') && donnees.vignette !== '' && donnees.vignette.substring(1, definirDossierFichiers(mur).length + 1) === definirDossierFichiers(mur)) {
															supprimerVignette(donnees.vignette)
														}
														const multi = db.multi()
														multi.del('contenu-blocs:' + mur + ':' + blocs[i])
														multi.zrem('blocs:' + mur, blocs[i])
														multi.del('commentaires:' + blocs[i])
														multi.del('evaluations:' + blocs[i])
														multi.exec(function () {
															resolve(blocs[i])
														})
													} else {
														resolve(blocs[i])
													}
												})
											}
										})
									})
									donneesBlocs.push(donneesBloc)
									const donneesActivite = new Promise(function (resolve) {
										db.zrange('activite:' + mur, 0, -1, function (err, entrees) {
											if (err) { resolve() }
											for (let i = 0; i < entrees.length; i++) {
												const entree = JSON.parse(entrees[i])
												if (entree.identifiant === identifiant) {
													db.zremrangebyscore('activite:' + mur, entree.id, entree.id, function () {
														resolve(entree.id)
													})
												} else {
													resolve(entree.id)
												}
											}
										})
									})
									donneesActivites.push(donneesActivite)
									const donneesCommentaire = new Promise(function (resolve) {
										db.zrange('blocs:' + mur, 0, -1, function (err, blocs) {
											if (err) { resolve() }
											for (let i = 0; i < blocs.length; i++) {
												db.zrange('commentaires:' + blocs[i], 0, -1, function (err, commentaires) {
													if (err) { resolve() }
													for (let j = 0; j < commentaires.length; j++) {
														const commentaire = JSON.parse(commentaires[j])
														if (commentaire.identifiant === identifiant) {
															db.zremrangebyscore('commentaires:' + blocs[i], commentaire.id, commentaire.id, function () {
																resolve(commentaire.id)
															})
														} else {
															resolve(commentaire.id)
														}
													}
												})
											}
										})
									})
									donneesCommentaires.push(donneesCommentaire)
									const donneesEvaluation = new Promise(function (resolve) {
										db.zrange('blocs:' + mur, 0, -1, function (err, blocs) {
											if (err) { resolve() }
											for (let i = 0; i < blocs.length; i++) {
												db.zrange('evaluations:' + blocs[i], 0, -1, function (err, evaluations) {
													if (err) { resolve() }
													for (let j = 0; j < evaluations.length; j++) {
														const evaluation = JSON.parse(evaluations[j])
														if (evaluation.identifiant === identifiant) {
															db.zremrangebyscore('evaluations:' + blocs[i], evaluation.id, evaluation.id, function () {
																resolve(evaluation.id)
															})
														} else {
															resolve(evaluation.id)
														}
													}
												})
											}
										})
									})
									donneesEvaluations.push(donneesEvaluation)
								} else if (resultat !== 1 && await fs.pathExists(path.join(__dirname, '..', '/static/murs/' + mur + '.json'))) {
									const donnees = await fs.readJson(path.join(__dirname, '..', '/static/murs/' + mur + '.json'))
									if (typeof donnees === 'object' && donnees !== null && donnees.hasOwnProperty('mur') && donnees.hasOwnProperty('blocs') && donnees.hasOwnProperty('activite')) {
										const blocs = donnees.blocs
										const entrees = donnees.activite
										const donneesBloc = new Promise(function (resolve) {
											for (let i = 0; i < blocs.length; i++) {
												if (blocs[i].hasOwnProperty('identifiant') && blocs[i].identifiant === identifiant) {
													if (blocs[i].hasOwnProperty('media') && blocs[i].media !== '' && blocs[i].type !== 'embed') {
														supprimerFichier(mur, blocs[i].media)
													}
													if (blocs[i].hasOwnProperty('mediaExtra') && blocs[i].mediaExtra !== '') {
														supprimerFichier(mur, blocs[i].mediaExtra)
													}
													if (blocs[i].hasOwnProperty('medias')) {
														const medias = JSON.parse(blocs[i].medias)
														for (let i = 0; i < medias.length; i++) {
															if (medias[i].hasOwnProperty('fichier')) {
																supprimerFichier(mur, medias[i].fichier)
															}
														}
													}
													if (blocs[i].hasOwnProperty('vignette') && blocs[i].vignette !== '' && blocs[i].vignette.substring(1, definirDossierFichiers(mur).length + 1) === definirDossierFichiers(mur)) {
														supprimerVignette(blocs[i].vignette)
													}
													const multi = db.multi()
													multi.del('contenu-blocs:' + mur + ':' + blocs[i].bloc)
													multi.zrem('blocs:' + mur, blocs[i].bloc)
													multi.del('commentaires:' + blocs[i].bloc)
													multi.del('evaluations:' + blocs[i].bloc)
													multi.exec(function () {
														resolve(blocs[i].bloc)
													})
												} else {
													resolve(blocs[i].bloc)
												}
											}
										})
										donneesBlocs.push(donneesBloc)
										const donneesActivite = new Promise(function (resolve) {
											for (let i = 0; i < entrees.length; i++) {
												if (entrees[i].identifiant === identifiant) {
													db.zremrangebyscore('activite:' + mur, entrees[i].id, entrees[i].id, function () {
														resolve(entrees[i].id)
													})
												} else {
													resolve(entrees[i].id)
												}
											}
										})
										donneesActivites.push(donneesActivite)
										const donneesCommentaire = new Promise(function (resolve) {
											for (let i = 0; i < blocs.length; i++) {
												db.zrange('commentaires:' + blocs[i].bloc, 0, -1, function (err, commentaires) {
													if (err) { resolve() }
													for (let j = 0; j < commentaires.length; j++) {
														const commentaire = JSON.parse(commentaires[j])
														if (commentaire.identifiant === identifiant) {
															db.zremrangebyscore('commentaires:' + blocs[i].bloc, commentaire.id, commentaire.id, function () {
																resolve(commentaire.id)
															})
														} else {
															resolve(commentaire.id)
														}
													}
												})
											}
										})
										donneesCommentaires.push(donneesCommentaire)
										const donneesEvaluation = new Promise(function (resolve) {
											for (let i = 0; i < blocs.length; i++) {
												db.zrange('evaluations:' + blocs[i].bloc, 0, -1, function (err, evaluations) {
													if (err) { resolve() }
													for (let j = 0; j < evaluations.length; j++) {
														const evaluation = JSON.parse(evaluations[j])
														if (evaluation.identifiant === identifiant) {
															db.zremrangebyscore('evaluations:' + blocs[i].bloc, evaluation.id, evaluation.id, function () {
																resolve(evaluation.id)
															})
														} else {
															resolve(evaluation.id)
														}
													}
												})
											}
										})
										donneesEvaluations.push(donneesEvaluation)
									}
								}
							})
						}
						Promise.all([donneesBlocs, donneesActivites, donneesCommentaires, donneesEvaluations]).then(function () {
							const multi = db.multi()
							multi.del('murs-crees:' + identifiant)
							multi.del('murs-rejoints:' + identifiant)
							multi.del('murs-favoris:' + identifiant)
							multi.del('murs-admins:' + identifiant)
							multi.del('murs-utilisateurs:' + identifiant)
							multi.del('utilisateurs:' + identifiant)
							multi.del('noms:' + identifiant)
							multi.exec(function () {
								if (type === 'utilisateur') {
									req.session.identifiant = ''
									req.session.nom = ''
									req.session.email = ''
									req.session.langue = ''
									req.session.statut = ''
									req.session.destroy()
									res.send('compte_supprime')
								} else {
									db.keys('sessions:*', function (err, sessions) {
										if (sessions !== null) {
											const donneesSessions = []
											sessions.forEach(function (session) {
												const donneesSession = new Promise(function (resolve) {
													db.get('sessions:' + session.substring(9), function (err, donnees) {
														if (err) { resolve({}) }
														if (donnees !== null) {
															donnees = JSON.parse(donnees)
														} else {
															resolve({})
														}
														if (donnees.hasOwnProperty('identifiant')) {
															resolve({ session: session.substring(9), identifiant: donnees.identifiant })
														} else {
															resolve({})
														}
													})
												})
												donneesSessions.push(donneesSession)
											})
											Promise.all(donneesSessions).then(function (donnees) {
												let sessionId = ''
												donnees.forEach(function (item) {
													if (item.hasOwnProperty('identifiant') && item.identifiant === identifiant) {
														sessionId = item.session
													}
												})
												if (sessionId !== '') {
													db.del('sessions:' + sessionId)
												}
												res.send('compte_supprime')
											})
										}
									})
								}
							})
						})
					})
				})
			})
		} else {
			res.send('non_connecte')
		}
	})

	app.post('/api/verifier-identifiant', function (req, res) {
		const identifiant = req.body.identifiant
		db.exists('utilisateurs:' + identifiant, function (err, resultat) {
			if (err) { res.send('erreur'); return false }
			if (resultat === 1) {
				res.send('identifiant_valide')
			} else {
				res.send('identifiant_non_valide')
			}
		})
	})

	app.post('/api/verifier-mot-de-passe', function (req, res) {
		const mur = req.body.mur
		db.hgetall('murs:' + mur, async function (err, donnees) {
			if (err || !donnees || !donnees.hasOwnProperty('motdepasse')) { res.send('erreur'); return false }
			if (await bcrypt.compare(req.body.motdepasse, donnees.motdepasse)) {
				res.send('motdepasse_correct')
			} else if (req.body.motdepasse === donnees.motdepasseAdmin) {
				res.send('motdepasseadmin_correct')
			} else {
				res.send('motdepasse_incorrect')
			}
		})
	})

	app.post('/api/verifier-code-acces', function (req, res) {
		const mur = req.body.mur
		db.hgetall('murs:' + mur, function (err, donnees) {
			if (err || !donnees || !donnees.hasOwnProperty('code')) { res.send('erreur'); return false }
			if (req.body.code === donnees.code) {
				if (!req.session.acces) {
					req.session.acces = []
				}
				const murAcces = req.session.acces.map(function (e) {
					if (e.hasOwnProperty('mur')) {
						return e.mur
					} else {
						return ''
					}
				})
				if (murAcces === mur) {
					req.session.acces.forEach(function (acces, index) {
						if (acces.mur === mur) {
							req.session.acces[index].code = donnees.code
						}
					})
				} else {
					req.session.acces.push({ code: donnees.code, mur: mur })
				}
				res.send('code_correct')
			} else {
				res.send('code_incorrect')
			}
		})
	})

	app.post('/api/verifier-acces', function (req, res) {
		const mur = req.body.mur
		const identifiant = req.body.identifiant
		db.hgetall('murs:' + mur, async function (err, donnees) {
			if (err) { res.send('erreur'); return false }
			if (identifiant === donnees.identifiant && donnees.hasOwnProperty('motdepasse') && await bcrypt.compare(req.body.motdepasse, donnees.motdepasse)) {
				db.hgetall('utilisateurs:' + identifiant, function (err, utilisateur) {
					if (err) { res.send('erreur'); return false }
					req.session.identifiant = identifiant
					req.session.nom = utilisateur.nom
					req.session.statut = 'auteur'
					req.session.langue = utilisateur.langue
					if (!req.session.hasOwnProperty('digidrive')) {
						req.session.digidrive = []
					}
					if (!req.session.digidrive.includes(mur)) {
						req.session.digidrive.push(mur)
					}
					req.session.cookie.expires = new Date(Date.now() + dureeSession)
					res.json({ message: 'mur_debloque', nom: utilisateur.nom, langue: utilisateur.langue, digidrive: req.session.digidrive })
				})
			} else if (identifiant === donnees.identifiant && !donnees.hasOwnProperty('motdepasse')) {
				db.exists('utilisateurs:' + identifiant, function (err, resultat) {
					if (err) { res.send('erreur'); return false }
					if (resultat === 1) {
						db.hgetall('utilisateurs:' + identifiant, async function (err, utilisateur) {
							if (err) { res.send('erreur'); return false }
							if (await bcrypt.compare(req.body.motdepasse, utilisateur.motdepasse)) {
								req.session.identifiant = identifiant
								req.session.nom = utilisateur.nom
								req.session.statut = 'auteur'
								req.session.langue = utilisateur.langue
								if (!req.session.hasOwnProperty('digidrive')) {
									req.session.digidrive = []
								}
								if (!req.session.digidrive.includes(mur)) {
									req.session.digidrive.push(mur)
								}
								req.session.cookie.expires = new Date(Date.now() + dureeSession)
								res.json({ message: 'mur_debloque', nom: utilisateur.nom, langue: utilisateur.langue, digidrive: req.session.digidrive })
							} else {
								res.send('erreur')
							}
						})
					} else {
						res.send('erreur')
					}
				})
			} else {
				res.send('erreur')
			}
		})
	})

	app.post('/api/modifier-langue', function (req, res) {
		const identifiant = req.body.identifiant
		const langue = req.body.langue
		if (req.session.identifiant && req.session.identifiant === identifiant) {
			db.hset('utilisateurs:' + identifiant, 'langue', langue)
			req.session.langue = langue
		} else {
			req.session.langue = langue
		}
		res.send('langue_modifiee')
	})

	app.post('/api/modifier-affichage', function (req, res) {
		const identifiant = req.body.identifiant
		if (req.session.identifiant && req.session.identifiant === identifiant) {
			const affichage = req.body.affichage
			db.hset('utilisateurs:' + identifiant, 'affichage', affichage)
			res.send('affichage_modifie')
		} else {
			res.send('non_connecte')
		}
	})

	app.post('/api/modifier-classement', function (req, res) {
		const identifiant = req.body.identifiant
		if (req.session.identifiant && req.session.identifiant === identifiant) {
			const classement = req.body.classement
			db.hset('utilisateurs:' + identifiant, 'classement', classement)
			req.session.classement = classement
			res.send('classement_modifie')
		} else {
			res.send('non_connecte')
		}
	})

	app.post('/api/ajouter-dossier', function (req, res) {
		const identifiant = req.body.identifiant
		if (req.session.identifiant && req.session.identifiant === identifiant) {
			const nom = req.body.dossier
			db.hgetall('utilisateurs:' + identifiant, function (err, donnees) {
				if (err) { res.send('erreur_ajout_dossier'); return false }
				let dossiers = []
				if (donnees.hasOwnProperty('dossiers')) {
					dossiers = JSON.parse(donnees.dossiers)
				}
				const id = Math.random().toString(36).substring(2)
				dossiers.push({ id: id, nom: nom, murs: [] })
				db.hset('utilisateurs:' + identifiant, 'dossiers', JSON.stringify(dossiers), function (err) {
					if (err) { res.send('erreur_ajout_dossier'); return false }
					res.json({ id: id, nom: nom, murs: [] })
				})
			})
		} else {
			res.send('non_connecte')
		}
	})

	app.post('/api/modifier-dossier', function (req, res) {
		const identifiant = req.body.identifiant
		if (req.session.identifiant && req.session.identifiant === identifiant) {
			const nom = req.body.dossier
			const dossierId = req.body.dossierId
			db.hgetall('utilisateurs:' + identifiant, function (err, donnees) {
				if (err) { res.send('erreur_modification_dossier'); return false }
				const dossiers = JSON.parse(donnees.dossiers)
				dossiers.forEach(function (dossier, index) {
					if (dossier.id === dossierId) {
						dossiers[index].nom = nom
					}
				})
				db.hset('utilisateurs:' + identifiant, 'dossiers', JSON.stringify(dossiers), function (err) {
					if (err) { res.send('erreur_modification_dossier'); return false }
					res.send('dossier_modifie')
				})
			})
		} else {
			res.send('non_connecte')
		}
	})

	app.post('/api/supprimer-dossier', function (req, res) {
		const identifiant = req.body.identifiant
		if (req.session.identifiant && req.session.identifiant === identifiant) {
			const dossierId = req.body.dossierId
			db.hgetall('utilisateurs:' + identifiant, function (err, donnees) {
				if (err) { res.send('erreur_suppression_dossier'); return false }
				const dossiers = JSON.parse(donnees.dossiers)
				dossiers.forEach(function (dossier, index) {
					if (dossier.id === dossierId) {
						dossiers.splice(index, 1)
					}
				})
				db.hset('utilisateurs:' + identifiant, 'dossiers', JSON.stringify(dossiers), function (err) {
					if (err) { res.send('erreur_suppression_dossier'); return false }
					res.send('dossier_supprime')
				})
			})
		} else {
			res.send('non_connecte')
		}
	})

	app.post('/api/televerser-fichier', function (req, res) {
		const identifiant = req.session.identifiant
		if (!identifiant) {
			res.send('non_connecte')
		} else {
			televerserTemp(req, res, async function (err) {
				if (err) { res.send('erreur_televersement'); return false }
				const fichier = req.file
				if (fichier.hasOwnProperty('mimetype') && fichier.hasOwnProperty('filename')) {
					let mimetype = fichier.mimetype
					const chemin = path.join(__dirname, '..', '/static/temp/' + fichier.filename)
					const destination = path.join(__dirname, '..', '/static/temp/' + path.parse(fichier.filename).name + '.jpg')
					const destinationPDF = path.join(__dirname, '..', '/static/temp/' + path.parse(fichier.filename).name + '.pdf')
					if (mimetype.split('/')[0] === 'image') {
						const extension = path.parse(fichier.filename).ext
						if (extension.toLowerCase() === '.jpg' || extension.toLowerCase() === '.jpeg') {
							sharp(chemin).withMetadata().rotate().jpeg().resize(1200, 1200, {
								fit: sharp.fit.inside,
								withoutEnlargement: true
							}).toBuffer((err, buffer) => {
								if (err) { res.send('erreur_televersement'); return false }
								fs.writeFile(chemin, buffer, function () {
									res.json({ fichier: fichier.filename, mimetype: mimetype })
								})
							})
						} else if (extension.toLowerCase() !== '.gif') {
							sharp(chemin).withMetadata().resize(1200, 1200, {
								fit: sharp.fit.inside,
								withoutEnlargement: true
							}).toBuffer((err, buffer) => {
								if (err) { res.send('erreur_televersement'); return false }
								fs.writeFile(chemin, buffer, function () {
									res.json({ fichier: fichier.filename, mimetype: mimetype })
								})
							})
						} else {
							res.json({ fichier: fichier.filename, mimetype: mimetype })
						}
					} else if (mimetype === 'application/pdf') {
						gm(chemin + '[0]').setFormat('jpg').resize(450).quality(80).write(destination, function (erreur) {
							if (erreur) {
								res.json({ fichier: fichier.filename, mimetype: 'pdf', vignetteGeneree: false })
							} else {
								res.json({ fichier: fichier.filename, mimetype: 'pdf', vignetteGeneree: true })
							}
						})
					} else if (mimetype === 'application/vnd.oasis.opendocument.presentation' || mimetype === 'application/vnd.oasis.opendocument.text' || mimetype === 'application/vnd.oasis.opendocument.spreadsheet') {
						mimetype = 'document'
						const docBuffer = await fs.readFile(chemin)
						const pdfBuffer = await libre.convertAsync(docBuffer, '.pdf', undefined)
						await fs.writeFile(destinationPDF, pdfBuffer)
						if (await fs.pathExists(destinationPDF)) {
							gm(destinationPDF + '[0]').setFormat('jpg').resize(450).quality(80).write(destination, async function (erreur) {
								await fs.remove(destinationPDF)
								if (erreur) {
									res.json({ fichier: fichier.filename, mimetype: mimetype, vignetteGeneree: false })
								} else {
									res.json({ fichier: fichier.filename, mimetype: mimetype, vignetteGeneree: true })
								}
							})
						} else {
							res.json({ fichier: fichier.filename, mimetype: mimetype, vignetteGeneree: false })
						}
					} else if (mimetype === 'application/msword' || mimetype === 'application/vnd.ms-powerpoint' || mimetype === 'application/vnd.ms-excel' || mimetype.includes('officedocument') === true) {
						mimetype = 'office'
						const docBuffer = await fs.readFile(chemin)
						const pdfBuffer = await libre.convertAsync(docBuffer, '.pdf', undefined)
						await fs.writeFile(destinationPDF, pdfBuffer)
						if (await fs.pathExists(destinationPDF)) {
							gm(destinationPDF + '[0]').setFormat('jpg').resize(450).quality(80).write(destination, async function (erreur) {
								await fs.remove(destinationPDF)
								if (erreur) {
									res.json({ fichier: fichier.filename, mimetype: mimetype, vignetteGeneree: false })
								} else {
									res.json({ fichier: fichier.filename, mimetype: mimetype, vignetteGeneree: true })
								}
							})
						} else {
							res.json({ fichier: fichier.filename, mimetype: mimetype, vignetteGeneree: false })
						}
					} else {
						res.json({ fichier: fichier.filename, mimetype: mimetype })
					}
				} else {
					res.send('erreur_televersement')
				}
			})
		}
	})

	app.post('/api/televerser-audio', function (req, res) {
		const identifiant = req.session.identifiant
		if (!identifiant) {
			res.send('non_connecte')
		} else {
			televerser(req, res, function (err) {
				if (err) { res.send('erreur_televersement'); return false }
				const fichier = req.file
				res.send(fichier.filename)
			})
		}
	})

	app.post('/api/televerser-vignette', function (req, res) {
		const identifiant = req.session.identifiant
		if (!identifiant) {
			res.send('non_connecte')
		} else {
			televerserTemp(req, res, function (err) {
				if (err) { res.send('erreur_televersement'); return false }
				const fichier = req.file
				const chemin = path.join(__dirname, '..', '/static/temp/' + fichier.filename)
				const extension = path.parse(fichier.filename).ext
				if (extension.toLowerCase() === '.jpg' || extension.toLowerCase() === '.jpeg') {
					sharp(chemin).withMetadata().rotate().jpeg().resize(400, 400, {
						fit: sharp.fit.inside,
						withoutEnlargement: true
					}).toBuffer((err, buffer) => {
						if (err) { res.send('erreur_televersement'); return false }
						fs.writeFile(chemin, buffer, function () {
							res.send('/temp/' + fichier.filename)
						})
					})
				} else {
					sharp(chemin).withMetadata().resize(400, 400, {
						fit: sharp.fit.inside,
						withoutEnlargement: true
					}).toBuffer((err, buffer) => {
						if (err) { res.send('erreur_televersement'); return false }
						fs.writeFile(chemin, buffer, function () {
							res.send('/temp/' + fichier.filename)
						})
					})
				}
			})
		}
	})

	app.post('/api/televerser-fond', function (req, res) {
		const identifiant = req.session.identifiant
		if (!identifiant) {
			res.send('non_connecte')
		} else {
			televerser(req, res, function (err) {
				if (err) { res.send('erreur_televersement'); return false }
				const fichier = req.file
				const mur = req.body.mur
				const chemin = path.join(__dirname, '..', '/static/' + definirDossierFichiers(mur) + '/' + mur + '/' + fichier.filename)
				const extension = path.parse(fichier.filename).ext
				if (extension.toLowerCase() === '.jpg' || extension.toLowerCase() === '.jpeg') {
					sharp(chemin).withMetadata().rotate().jpeg().resize(1200, 1200, {
						fit: sharp.fit.inside,
						withoutEnlargement: true
					}).toBuffer((err, buffer) => {
						if (err) { res.send('erreur_televersement'); return false }
						fs.writeFile(chemin, buffer, function () {
							res.send('/' + definirDossierFichiers(mur) + '/' + mur + '/' + fichier.filename)
						})
					})
				} else {
					sharp(chemin).withMetadata().resize(1200, 1200, {
						fit: sharp.fit.inside,
						withoutEnlargement: true
					}).toBuffer((err, buffer) => {
						if (err) { res.send('erreur_televersement'); return false }
						fs.writeFile(chemin, buffer, function () {
							res.send('/' + definirDossierFichiers(mur) + '/' + mur + '/' + fichier.filename)
						})
					})
				}
			})
		}
	})

	app.post('/api/recuperer-icone', async function (req, res) {
		const identifiant = req.session.identifiant
		if (!identifiant) {
			res.send('erreur')
		} else {
			const domaine = req.body.domaine
			const protocole = req.body.protocole
			const reponse = await axios.get(protocole + '//' + domaine, { responseType: 'document' }).catch(function () {
				res.send('erreur')
			})
			const $ = cheerio.load(reponse.data)
			let favicon = ''
			const recupererTaille = function (el) {
				return (el.attribs.sizes && parseInt(el.attribs.sizes, 10)) || 0
			}
			let favicons = [
				...$('meta[property="og:image"]')
			]
			if (favicons.length > 0) {
				favicon = favicons[0].attribs.content
			} else {
				favicons = [
					...$('link[rel="shortcut icon"], link[rel="icon"], link[rel="apple-touch-icon"]')
				].sort((a, b) => {
					return recupererTaille(b) - recupererTaille(a)
				})
				favicon = favicons[0].attribs.href
			}
			if (favicon !== '' && verifierURL(favicon, ['https', 'http']) === true) {
				res.send(favicon)
			} else if (favicon !== '' && favicon.substring(0, 2) === './') {
				res.send(protocole + '//' + domaine + favicon.substring(1))
			} else if (favicon !== '' && favicon.substring(0, 1) === '/') {
				res.send(protocole + '//' + domaine + favicon)
			} else if (favicon !== '') {
				res.send(protocole + '//' + domaine + '/' + favicon)
			} else {
				res.send(favicon)
			}
		}
	})

	app.post('/api/ladigitale', function (req, res) {
		const tokenApi = req.body.token
		const domaine = req.headers.host
		const lien = req.body.lien
		const params = new URLSearchParams()
		params.append('token', tokenApi)
		params.append('domaine', domaine)
		axios.post(lien, params).then(async function (reponse) {
			if (reponse.data === 'non_autorise' || reponse.data === 'erreur') {
				res.send('erreur_token')
			} else if (reponse.data === 'token_autorise' && req.body.action && req.body.action === 'creer') {
				const identifiant = req.body.identifiant
				let nom = req.body.nomUtilisateur
				if (nom === '') {
					nom = identifiant.toUpperCase()
				}
				const titre = req.body.nom
				const motdepasse = req.body.motdepasse
				const hash = await bcrypt.hash(motdepasse, 10)
				const token = Math.random().toString(16).slice(10)
				const slug = definirSlug(titre)
				const date = dayjs().format()
				let langue = 'fr'
				if (req.session.hasOwnProperty('langue') && req.session.langue !== '' && req.session.langue !== undefined) {
					langue = req.session.langue
				}
				db.exists('mur', function (err, resultat) {
					if (err) { res.send('erreur'); return false }
					if (resultat === 1) {
						db.get('mur', function (err, resultat) {
							if (err) { res.send('erreur'); return false }
							const id = parseInt(resultat) + 1
							creerMurSansCompte(req, res, id, token, slug, titre, hash, date, identifiant, nom, langue, 'api')
						})
					} else {
						creerMurSansCompte(req, res, 1, token, slug, titre, hash, date, identifiant, nom, langue, 'api')
					}
				})
			} else if (reponse.data === 'token_autorise' && req.body.action && req.body.action === 'modifier-titre') {
				const mur = req.body.id
				const titre = req.body.titre
				db.hset('murs:' + mur, 'titre', titre, function (err) {
					if (err) { res.send('erreur'); return false }
					const slug = definirSlug(titre)
					res.send(slug)
				})
			} else if (reponse.data === 'token_autorise' && req.body.action && req.body.action === 'ajouter') {
				const identifiant = req.body.identifiant
				const mur = req.body.id
				const token = req.body.tokenContenu
				const motdepasse = req.body.motdepasse
				const nom = req.body.nomUtilisateur
				db.exists('murs:' + mur, async function (err, resultat) {
					if (err) { res.send('erreur'); return false }
					if (resultat === 1) {
						db.hgetall('murs:' + mur, async function (err, donneesMur) {
							if (err) { res.send('erreur'); return false }
							if (donneesMur.hasOwnProperty('motdepasse') && await bcrypt.compare(motdepasse, donneesMur.motdepasse) && token === donneesMur.token) {
								const date = dayjs().format()
								let langue = 'fr'
								if (req.session.hasOwnProperty('langue') && req.session.langue !== '' && req.session.langue !== undefined) {
									langue = req.session.langue
								}
								const multi = db.multi()
								multi.hmset('utilisateurs:' + identifiant, 'id', identifiant, 'date', date, 'nom', nom, 'langue', langue)
								multi.hset('murs:' + mur, 'identifiant', identifiant)
								multi.exec(function (err) {
									if (err) { res.send('erreur'); return false }
									res.json({ titre: donneesMur.titre, identifiant: identifiant })
								})
							} else if (!donneesMur.hasOwnProperty('motdepasse') && token === donneesMur.token) {
								db.exists('utilisateurs:' + donneesMur.identifiant, function (err, resultat) {
									if (err) { res.send('erreur'); return false }
									if (resultat === 1) {
										db.hgetall('utilisateurs:' + donneesMur.identifiant, async function (err, utilisateur) {
											if (err) { res.send('erreur'); return false }
											if (await bcrypt.compare(motdepasse, utilisateur.motdepasse)) {
												res.json({ titre: donneesMur.titre, identifiant: donneesMur.identifiant })
											} else {
												res.send('non_autorise')
											}
										})
									} else {
										res.send('erreur')
									}
								})
							} else {
								res.send('non_autorise')
							}
						})
					} else if (resultat !== 1 && await fs.pathExists(path.join(__dirname, '..', '/static/murs/mur-' + mur + '.json'))) {
						const donneesMur = await fs.readJson(path.join(__dirname, '..', '/static/murs/mur-' + mur + '.json'))
						if (typeof donneesMur === 'object' && donneesMur !== null) {
							if (donneesMur.hasOwnProperty('motdepasse') && await bcrypt.compare(motdepasse, donneesMur.motdepasse) && token === donneesMur.token) {
								const date = dayjs().format()
								let langue = 'fr'
								if (req.session.hasOwnProperty('langue') && req.session.langue !== '' && req.session.langue !== undefined) {
									langue = req.session.langue
								}
								db.hmset('utilisateurs:' + identifiant, 'id', identifiant, 'date', date, 'nom', nom, 'langue', langue, async function (err) {
									if (err) { res.send('erreur'); return false }
									const chemin = path.join(__dirname, '..', '/static/murs')
									const donneesMurJSON = await fs.readJson(path.join(__dirname, '..', '/static/murs/' + mur + '.json'))
									if (typeof donneesMurJSON === 'object' && donneesMurJSON !== null && donneesMurJSON.hasOwnProperty('mur') && donneesMurJSON.hasOwnProperty('blocs') && donneesMurJSON.hasOwnProperty('activite')) {
										donneesMurJSON.mur.identifiant = identifiant
										fs.writeFile(path.normalize(chemin + '/' + mur + '.json'), JSON.stringify(donneesMurJSON, '', 4), 'utf8', function (err) {
											if (err) { res.send('erreur'); return false }
											donneesMur.identifiant = identifiant
											fs.writeFile(path.normalize(chemin + '/mur-' + mur + '.json'), JSON.stringify(donneesMur, '', 4), 'utf8', function (err) {
												if (err) { res.send('erreur'); return false }
												res.send(donneesMur.titre)
											})
										})
									} else {
										res.send('erreur')
									}
								})
							} else if (!donneesMur.hasOwnProperty('motdepasse') && token === donneesMur.token) {
								db.exists('utilisateurs:' + donneesMur.identifiant, function (err, resultat) {
									if (err) { res.send('erreur'); return false }
									if (resultat === 1) {
										db.hgetall('utilisateurs:' + donneesMur.identifiant, async function (err, utilisateur) {
											if (err) { res.send('erreur'); return false }
											if (await bcrypt.compare(motdepasse, utilisateur.motdepasse)) {
												res.json({ titre: donneesMur.titre, identifiant: donneesMur.identifiant })
											} else {
												res.send('non_autorise')
											}
										})
									} else {
										res.send('erreur')
									}
								})
							} else {
								res.send('non_autorise')
							}
						} else {
							res.send('erreur')
						}
					} else {
						res.send('contenu_inexistant')
					}
				})
			} else if (reponse.data === 'token_autorise' && req.body.action && req.body.action === 'supprimer') {
				const identifiant = req.body.identifiant
				const mur = req.body.id
				const motdepasse = req.body.motdepasse
				db.exists('murs:' + mur, async function (err, resultat) {
					if (err) { res.send('erreur'); return false }
					if (resultat === 1) {
						db.hgetall('murs:' + mur, async function (err, donneesMur) {
							if (err) { res.send('erreur'); return false }
							if (donneesMur.hasOwnProperty('motdepasse') && donneesMur.identifiant === identifiant && await bcrypt.compare(motdepasse, donneesMur.motdepasse)) {
								db.zrange('blocs:' + mur, 0, -1, function (err, blocs) {
									if (err) { res.send('erreur'); return false }
									const multi = db.multi()
									for (let i = 0; i < blocs.length; i++) {
										multi.del('commentaires:' + blocs[i])
										multi.del('evaluations:' + blocs[i])
										multi.del('contenu-blocs:' + mur + ':' + blocs[i])
									}
									multi.del('blocs:' + mur)
									multi.del('murs:' + mur)
									multi.del('activite:' + mur)
									multi.del('dates-murs:' + mur)
									multi.srem('murs-crees:' + identifiant, mur)
									multi.smembers('utilisateurs-murs:' + mur, function (err, utilisateurs) {
										if (err) { res.send('erreur'); return false }
										for (let j = 0; j < utilisateurs.length; j++) {
											db.srem('murs-rejoints:' + utilisateurs[j], mur)
											db.srem('murs-utilisateurs:' + utilisateurs[j], mur)
											db.srem('murs-admins:' + utilisateurs[j], mur)
											db.srem('murs-favoris:' + utilisateurs[j], mur)
										}
									})
									multi.del('utilisateurs-murs:' + mur)
									multi.exec(async function () {
										const chemin = path.join(__dirname, '..', '/static/' + definirDossierFichiers(mur) + '/' + mur)
										await fs.remove(chemin)
										res.send('contenu_supprime')
									})
								})
							} else if (!donneesMur.hasOwnProperty('motdepasse') && donneesMur.identifiant === identifiant) {
								db.exists('utilisateurs:' + identifiant, function (err, resultat) {
									if (err) { res.send('erreur'); return false }
									if (resultat === 1) {
										db.hgetall('utilisateurs:' + identifiant, async function (err, utilisateur) {
											if (err) { res.send('erreur'); return false }
											if (await bcrypt.compare(motdepasse, utilisateur.motdepasse)) {
												db.zrange('blocs:' + mur, 0, -1, function (err, blocs) {
													if (err) { res.send('erreur'); return false }
													const multi = db.multi()
													for (let i = 0; i < blocs.length; i++) {
														multi.del('commentaires:' + blocs[i])
														multi.del('evaluations:' + blocs[i])
														multi.del('contenu-blocs:' + mur + ':' + blocs[i])
													}
													multi.del('blocs:' + mur)
													multi.del('murs:' + mur)
													multi.del('activite:' + mur)
													multi.del('dates-murs:' + mur)
													multi.srem('murs-crees:' + identifiant, mur)
													multi.smembers('utilisateurs-murs:' + mur, function (err, utilisateurs) {
														if (err) { res.send('erreur'); return false }
														for (let j = 0; j < utilisateurs.length; j++) {
															db.srem('murs-rejoints:' + utilisateurs[j], mur)
															db.srem('murs-utilisateurs:' + utilisateurs[j], mur)
															db.srem('murs-admins:' + utilisateurs[j], mur)
															db.srem('murs-favoris:' + utilisateurs[j], mur)
														}
													})
													multi.del('utilisateurs-murs:' + mur)
													multi.exec(async function () {
														const chemin = path.join(__dirname, '..', '/static/' + definirDossierFichiers(mur) + '/' + mur)
														await fs.remove(chemin)
														res.send('contenu_supprime')
													})
												})
											} else {
												res.send('non_autorise')
											}
										})
									} else {
										res.send('erreur')
									}
								})			
							} else {
								res.send('non_autorise')
							}
						})
					} else if (resultat !== 1 && await fs.pathExists(path.join(__dirname, '..', '/static/murs/mur-' + mur + '.json'))) {
						const donneesMur = await fs.readJson(path.join(__dirname, '..', '/static/murs/mur-' + mur + '.json'))
						if (typeof donneesMur === 'object' && donneesMur !== null) {
							const multi = db.multi()
							if (donneesMur.hasOwnProperty('motdepasse') && donneesMur.identifiant === identifiant && await bcrypt.compare(motdepasse, donneesMur.motdepasse)) {
								multi.srem('murs-crees:' + identifiant, mur)
								multi.smembers('utilisateurs-murs:' + mur, function (err, utilisateurs) {
									if (err) { res.send('erreur'); return false }
									for (let j = 0; j < utilisateurs.length; j++) {
										db.srem('murs-rejoints:' + utilisateurs[j], mur)
										db.srem('murs-utilisateurs:' + utilisateurs[j], mur)
										db.srem('murs-admins:' + utilisateurs[j], mur)
										db.srem('murs-favoris:' + utilisateurs[j], mur)
									}
								})
								multi.del('utilisateurs-murs:' + mur)
								multi.exec(async function () {
									await fs.remove(path.join(__dirname, '..', '/static/' + definirDossierFichiers(mur) + '/' + mur))
									await fs.remove(path.join(__dirname, '..', '/static/murs/' + mur + '.json'))
									await fs.remove(path.join(__dirname, '..', '/static/murs/mur-' + mur + '.json'))
									res.send('contenu_supprime')
								})
							} else if (!donneesMur.hasOwnProperty('motdepasse') && donneesMur.identifiant === identifiant) {
								db.exists('utilisateurs:' + identifiant, function (err, resultat) {
									if (err) { res.send('erreur'); return false }
									if (resultat === 1) {
										db.hgetall('utilisateurs:' + identifiant, async function (err, utilisateur) {
											if (err) { res.send('erreur'); return false }
											if (await bcrypt.compare(motdepasse, utilisateur.motdepasse)) {
												db.zrange('blocs:' + mur, 0, -1, function (err, blocs) {
													if (err) { res.send('erreur'); return false }
													const multi = db.multi()
													for (let i = 0; i < blocs.length; i++) {
														multi.del('commentaires:' + blocs[i])
														multi.del('evaluations:' + blocs[i])
														multi.del('contenu-blocs:' + mur + ':' + blocs[i])
													}
													multi.del('blocs:' + mur)
													multi.del('murs:' + mur)
													multi.del('activite:' + mur)
													multi.del('dates-murs:' + mur)
													multi.srem('murs-crees:' + identifiant, mur)
													multi.smembers('utilisateurs-murs:' + mur, function (err, utilisateurs) {
														if (err) { res.send('erreur'); return false }
														for (let j = 0; j < utilisateurs.length; j++) {
															db.srem('murs-rejoints:' + utilisateurs[j], mur)
															db.srem('murs-utilisateurs:' + utilisateurs[j], mur)
															db.srem('murs-admins:' + utilisateurs[j], mur)
															db.srem('murs-favoris:' + utilisateurs[j], mur)
														}
													})
													multi.del('utilisateurs-murs:' + mur)
													multi.exec(async function () {
														const chemin = path.join(__dirname, '..', '/static/' + definirDossierFichiers(mur) + '/' + mur)
														await fs.remove(chemin)
														res.send('contenu_supprime')
													})
												})
											} else {
												res.send('non_autorise')
											}
										})
									} else {
										res.send('erreur')
									}
								})			
							} else {
								res.send('non_autorise')
							}
						} else {
							res.send('erreur')
						}
					} else {
						res.send('contenu_supprime')
					}
				})
			} else {
				res.send('erreur')
			}
		}).catch(function () {
			res.send('erreur')
		})
	})

	app.use(function (req, res) {
		if (maintenance === true) {
			res.redirect('/maintenance')
		} else {
			res.redirect('/')
		}
	})

	const port = process.env.PORT || 3000
	httpServer.listen(port)

	const io = new Server(httpServer, { cookie: false })
	const wrap = middleware => (socket, next) => middleware(socket.request, {}, next)
	io.use(wrap(sessionMiddleware))

	io.on('connection', function (socket) {
		socket.on('connexion', async function (donnees) {
			const mur = donnees.mur
			const identifiant = donnees.identifiant
			const nom = donnees.nom
			const room = 'mur-' + mur
			socket.identifiant = identifiant
			socket.nom = nom
			socket.join(room)
			const clients = await io.in(room).fetchSockets()
			const utilisateurs = []
			for (let i = 0; i < clients.length; i++) {
				utilisateurs.push({ identifiant: clients[i].identifiant, nom: clients[i].nom })
			}
			const utilisateursConnectes = utilisateurs.filter((v, i, a) => a.findIndex(t => (t.identifiant === v.identifiant)) === i)
			io.in(room).emit('connexion', utilisateursConnectes)
		})

		socket.on('sortie', function (mur, identifiant) {
			socket.leave('mur-' + mur)
			socket.to('mur-' + mur).emit('deconnexion', identifiant)
		})

		socket.on('deconnexion', function (identifiant) {
			if (socket.request.session.hasOwnProperty('identifiant')) {
				socket.request.session.identifiant = ''
				socket.request.session.nom = ''
				socket.request.session.email = ''
				socket.request.session.langue = ''
				socket.request.session.statut = ''
				socket.request.session.save()
			}
			socket.broadcast.emit('deconnexion', identifiant)
		})

		socket.on('ajouterbloc', function (bloc, typeBloc, mur, token, titre, texte, media, iframe, type, source, vignette, vignetteActivee, mediaExtra, medias, couleur, colonne, privee, identifiant, nom, admin) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				db.hgetall('murs:' + mur, function (err, donnees) {
					if (err || !donnees || !donnees.hasOwnProperty('id') || !donnees.hasOwnProperty('token') || !donnees.hasOwnProperty('bloc')) { socket.emit('erreur'); return false }
					const id = parseInt(donnees.bloc) + 1
					db.hincrby('murs:' + mur, 'bloc', 1)
					if (donnees.id === mur && donnees.token === token) {
						const date = dayjs().format()
						const activiteId = parseInt(donnees.activite) + 1
						const multi = db.multi()
						let visibilite = 'visible'
						if (admin && privee === true) {
							visibilite = 'privee'
						} else if (!admin && donnees.contributions === 'moderees') {
							visibilite = 'masquee'
						}
						if (vignetteActivee === true) {
							vignetteActivee = 'oui'
						} else {
							vignetteActivee = 'non'
						}
						if (vignette && vignette !== '' && !vignette.includes('/img/') && !verifierURL(vignette, ['https', 'http'])) {
							vignette = '/' + definirDossierFichiers(mur) + '/' + mur + '/' + path.basename(vignette)
						}
						multi.hmset('contenu-blocs:' + mur + ':' + bloc, 'id', id, 'bloc', bloc, 'typeBloc', typeBloc, 'titre', titre, 'texte', texte, 'media', media, 'iframe', iframe, 'type', type, 'source', source, 'vignette', vignette, 'vignetteActivee', vignetteActivee, 'mediaExtra', mediaExtra, 'medias', JSON.stringify(medias), 'edition', 'oui', 'date', date, 'identifiant', identifiant, 'commentaires', 0, 'evaluations', 0, 'colonne', colonne, 'visibilite', visibilite, 'couleur', couleur)
						multi.zadd('blocs:' + mur, id, bloc)
						multi.hset('dates-murs:' + mur, 'date', date)
						if (visibilite === 'visible') {
							// Enregistrer entrée du registre d'activité
							multi.hincrby('murs:' + mur, 'activite', 1)
							multi.zadd('activite:' + mur, activiteId, JSON.stringify({ id: activiteId, bloc: bloc, identifiant: identifiant, titre: titre, date: date, type: 'bloc-ajoute' }))
						}
						multi.exec(async function () {
							if (media !== '' && type !== 'embed' && await fs.pathExists(path.join(__dirname, '..', '/static/temp/' + media))) {
								await fs.copy(path.join(__dirname, '..', '/static/temp/' + media), path.join(__dirname, '..', '/static/' + definirDossierFichiers(mur) + '/' + mur + '/' + media))
								await fs.remove(path.join(__dirname, '..', '/static/temp/' + media))
							}
							if (mediaExtra !== '' && await fs.pathExists(path.join(__dirname, '..', '/static/temp/' + mediaExtra))) {
								await fs.copy(path.join(__dirname, '..', '/static/temp/' + mediaExtra), path.join(__dirname, '..', '/static/' + definirDossierFichiers(mur) + '/' + mur + '/' + mediaExtra))
								await fs.remove(path.join(__dirname, '..', '/static/temp/' + mediaExtra))
							}
							for (let i = 0; i < medias.length; i++) {
								if (medias[i].fichier !== '' && await fs.pathExists(path.join(__dirname, '..', '/static/temp/' + medias[i].fichier))) {
									await fs.copy(path.join(__dirname, '..', '/static/temp/' + medias[i].fichier), path.join(__dirname, '..', '/static/' + definirDossierFichiers(mur) + '/' + mur + '/' + medias[i].fichier))
									await fs.remove(path.join(__dirname, '..', '/static/temp/' + medias[i].fichier))
								}
							}
							if (vignette && vignette !== '' && !vignette.includes('/img/') && !verifierURL(vignette, ['https', 'http']) && await fs.pathExists(path.join(__dirname, '..', '/static/temp/' + path.basename(vignette)))) {
								await fs.copy(path.join(__dirname, '..', '/static/temp/' + path.basename(vignette)), path.join(__dirname, '..', '/static' + vignette))
								await fs.remove(path.join(__dirname, '..', '/static/temp/' + path.basename(vignette)))
							}
							io.in('mur-' + mur).emit('ajouterbloc', { bloc: bloc, typeBloc: typeBloc, titre: titre, texte: texte, media: media, iframe: iframe, type: type, source: source, vignette: vignette, vignetteActivee: vignetteActivee, mediaExtra: mediaExtra, medias: medias, edition: 'oui', identifiant: identifiant, nom: nom, date: date, couleur: couleur, commentaires: 0, evaluations: [], colonne: colonne, visibilite: visibilite, activiteId: activiteId })
							socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
							socket.request.session.save()
						})
					}
				})
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifierbloc', function (bloc, typeBloc, mur, token, titre, texte, media, iframe, type, source, vignette, vignetteActivee, mediaExtra, medias, couleur, colonne, privee, identifiant, nom, admin) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				db.hgetall('murs:' + mur, function (err, donnees) {
					if (err || !donnees || !donnees.hasOwnProperty('id') || !donnees.hasOwnProperty('token')) { socket.emit('erreur'); return false }
					if (donnees.id === mur && donnees.token === token) {
						db.exists('contenu-blocs:' + mur + ':' + bloc, function (err, resultat) {
							if (err) { socket.emit('erreur'); return false }
							if (resultat === 1) {
								db.hgetall('contenu-blocs:' + mur + ':' + bloc, async function (err, objet) {
									if (err) { socket.emit('erreur'); return false }
									if (objet.identifiant === identifiant || admin || donnees.contributions === 'modifiables') {
										let visibilite = 'visible'
										if (objet.hasOwnProperty('visibilite')) {
											visibilite = objet.visibilite
										}
										if (privee === true) {
											visibilite = 'privee'
										}
										if (vignetteActivee === true) {
											vignetteActivee = 'oui'
										} else {
											vignetteActivee = 'non'
										}
										const edition = objet.edition
										const date = dayjs().format()
										if (vignette && objet.vignette && objet.vignette !== vignette && vignette !== '' && !vignette.includes('/img/') && !verifierURL(vignette, ['https', 'http'])) {
											vignette = '/' + definirDossierFichiers(mur) + '/' + mur + '/' + path.basename(vignette)
										}
										if (visibilite === 'visible') {
											// Enregistrer entrée du registre d'activité
											const activiteId = parseInt(donnees.activite) + 1
											const multi = db.multi()
											multi.hmset('contenu-blocs:' + mur + ':' + bloc, 'typeBloc', typeBloc, 'titre', titre, 'texte', texte, 'media', media, 'iframe', iframe, 'type', type, 'source', source, 'vignette', vignette, 'vignetteActivee', vignetteActivee, 'mediaExtra', mediaExtra, 'medias', JSON.stringify(medias), 'visibilite', 'visible', 'modifie', date, 'couleur', couleur)
											multi.hset('dates-murs:' + mur, 'date', date)
											multi.hincrby('murs:' + mur, 'activite', 1)
											multi.zadd('activite:' + mur, activiteId, JSON.stringify({ id: activiteId, bloc: bloc, identifiant: identifiant, titre: titre, date: date, type: 'bloc-modifie' }))
											multi.exec(async function () {
												if (objet.hasOwnProperty('media') && objet.media !== media && media !== '' && type !== 'embed' && await fs.pathExists(path.join(__dirname, '..', '/static/temp/' + media))) {
													await fs.copy(path.join(__dirname, '..', '/static/temp/' + media), path.join(__dirname, '..', '/static/' + definirDossierFichiers(mur) + '/' + mur + '/' + media))
													await fs.remove(path.join(__dirname, '..', '/static/temp/' + media))
												}
												if (objet.hasOwnProperty('media') && objet.media !== media && objet.media !== '' && objet.type !== 'embed') {
													supprimerFichier(mur, objet.media)
												}
												if (objet.hasOwnProperty('mediaExtra') && objet.mediaExtra !== mediaExtra && mediaExtra !== '' && await fs.pathExists(path.join(__dirname, '..', '/static/temp/' + mediaExtra))) {
													await fs.copy(path.join(__dirname, '..', '/static/temp/' + mediaExtra), path.join(__dirname, '..', '/static/' + definirDossierFichiers(mur) + '/' + mur + '/' + mediaExtra))
													await fs.remove(path.join(__dirname, '..', '/static/temp/' + mediaExtra))
												}
												if (objet.hasOwnProperty('mediaExtra') && objet.mediaExtra !== mediaExtra && objet.mediaExtra !== '') {
													supprimerFichier(mur, objet.mediaExtra)
												}
												if (objet.hasOwnProperty('medias')) {
													const mediasActuels = JSON.parse(objet.medias)
													for (let i = 0; i < medias.length; i++) {
														if (medias[i].hasOwnProperty('fichier') && medias[i].fichier !== '' && !mediasActuels.map(function (e) { return e.fichier }).includes(medias[i].fichier) && await fs.pathExists(path.join(__dirname, '..', '/static/temp/' + medias[i].fichier))) {
															await fs.copy(path.join(__dirname, '..', '/static/temp/' + medias[i].fichier), path.join(__dirname, '..', '/static/' + definirDossierFichiers(mur) + '/' + mur + '/' + medias[i].fichier))
															await fs.remove(path.join(__dirname, '..', '/static/temp/' + medias[i].fichier))
														}
													}
													mediasActuels.forEach(function (mediaActuel) {
														if (mediaActuel.hasOwnProperty('fichier') && !medias.map(function (e) { return e.fichier }).includes(mediaActuel.fichier)) {
															supprimerFichier(mur, mediaActuel.fichier)
														}
													})
												}
												if (objet.hasOwnProperty('vignette') && objet.vignette !== vignette && vignette !== '' && !vignette.includes('/img/') && !verifierURL(vignette, ['https', 'http']) && await fs.pathExists(path.join(__dirname, '..', '/static/temp/' + path.basename(vignette)))) {
													await fs.copy(path.join(__dirname, '..', '/static/temp/' + path.basename(vignette)), path.join(__dirname, '..', '/static' + vignette))
													await fs.remove(path.join(__dirname, '..', '/static/temp/' + path.basename(vignette)))
												}
												if (objet.hasOwnProperty('vignette') && objet.vignette !== vignette && objet.vignette.substring(1, definirDossierFichiers(mur).length + 1) === definirDossierFichiers(mur)) {
													supprimerVignette(objet.vignette)
												}
												io.in('mur-' + mur).emit('modifierbloc', { bloc: bloc, typeBloc: typeBloc, titre: titre, texte: texte, media: media, iframe: iframe, type: type, source: source, vignette: vignette, vignetteActivee: vignetteActivee, mediaExtra: mediaExtra, medias: medias, edition: edition, identifiant: identifiant, nom: nom, modifie: date, couleur: couleur, colonne: colonne, visibilite: visibilite, activiteId: activiteId })
												socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
												socket.request.session.save()
											})
										} else if (visibilite === 'privee' || visibilite === 'masquee') {
											const multi = db.multi()
											multi.hmset('contenu-blocs:' + mur + ':' + bloc, 'typeBloc', typeBloc, 'titre', titre, 'texte', texte, 'media', media, 'iframe', iframe, 'type', type, 'source', source, 'vignette', vignette, 'vignetteActivee', vignetteActivee, 'mediaExtra', mediaExtra, 'medias', JSON.stringify(medias), 'visibilite', visibilite, 'modifie', date, 'couleur', couleur)
											multi.hset('dates-murs:' + mur, 'date', date)
											multi.exec(async function () {
												if (objet.hasOwnProperty('media') && objet.media !== media && media !== '' && type !== 'embed' && await fs.pathExists(path.join(__dirname, '..', '/static/temp/' + media))) {
													await fs.copy(path.join(__dirname, '..', '/static/temp/' + media), path.join(__dirname, '..', '/static/' + definirDossierFichiers(mur) + '/' + mur + '/' + media))
													await fs.remove(path.join(__dirname, '..', '/static/temp/' + media))
												}
												if (objet.hasOwnProperty('media') && objet.media !== media && objet.media !== '' && objet.type !== 'embed') {
													supprimerFichier(mur, objet.media)
												}
												if (objet.hasOwnProperty('mediaExtra') && objet.mediaExtra !== mediaExtra && mediaExtra !== '' && await fs.pathExists(path.join(__dirname, '..', '/static/temp/' + mediaExtra))) {
													await fs.copy(path.join(__dirname, '..', '/static/temp/' + mediaExtra), path.join(__dirname, '..', '/static/' + definirDossierFichiers(mur) + '/' + mur + '/' + mediaExtra))
													await fs.remove(path.join(__dirname, '..', '/static/temp/' + mediaExtra))
												}
												if (objet.hasOwnProperty('mediaExtra') && objet.mediaExtra !== mediaExtra && objet.mediaExtra !== '') {
													supprimerFichier(mur, objet.mediaExtra)
												}
												if (objet.hasOwnProperty('medias')) {
													const mediasActuels = JSON.parse(objet.medias)
													for (let i = 0; i < medias.length; i++) {
														if (medias[i].hasOwnProperty('fichier') && medias[i].fichier !== '' && !mediasActuels.map(function (e) { return e.fichier }).includes(medias[i].fichier) && await fs.pathExists(path.join(__dirname, '..', '/static/temp/' + medias[i].fichier))) {
															await fs.copy(path.join(__dirname, '..', '/static/temp/' + medias[i].fichier), path.join(__dirname, '..', '/static/' + definirDossierFichiers(mur) + '/' + mur + '/' + medias[i].fichier))
															await fs.remove(path.join(__dirname, '..', '/static/temp/' + medias[i].fichier))
														}
													}
													mediasActuels.forEach(function (mediaActuel) {
														if (mediaActuel.hasOwnProperty('fichier') && !medias.map(function (e) { return e.fichier }).includes(mediaActuel.fichier)) {
															supprimerFichier(mur, mediaActuel.fichier)
														}
													})
												}
												if (objet.hasOwnProperty('vignette') && objet.vignette !== vignette && vignette !== '' && !vignette.includes('/img/') && !verifierURL(vignette, ['https', 'http']) && await fs.pathExists(path.join(__dirname, '..', '/static/temp/' + path.basename(vignette)))) {
													await fs.copy(path.join(__dirname, '..', '/static/temp/' + path.basename(vignette)), path.join(__dirname, '..', '/static' + vignette))
													await fs.remove(path.join(__dirname, '..', '/static/temp/' + path.basename(vignette)))
												}
												if (objet.hasOwnProperty('vignette') && objet.vignette !== vignette && objet.vignette.substring(1, definirDossierFichiers(mur).length + 1) === definirDossierFichiers(mur)) {
													supprimerVignette(objet.vignette)
												}
												io.in('mur-' + mur).emit('modifierbloc', { bloc: bloc, typeBloc: typeBloc, titre: titre, texte: texte, media: media, iframe: iframe, type: type, source: source, vignette: vignette, vignetteActivee: vignetteActivee, mediaExtra: mediaExtra, medias: medias, edition: edition, identifiant: identifiant, nom: nom, modifie: date, couleur: couleur, colonne: colonne, visibilite: visibilite })
												socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
												socket.request.session.save()
											})
										} else {
											if (objet.hasOwnProperty('media') && objet.media !== media && media !== '' && type !== 'embed' && await fs.pathExists(path.join(__dirname, '..', '/static/temp/' + media))) {
												await fs.copy(path.join(__dirname, '..', '/static/temp/' + media), path.join(__dirname, '..', '/static/' + definirDossierFichiers(mur) + '/' + mur + '/' + media))
												await fs.remove(path.join(__dirname, '..', '/static/temp/' + media))
											}
											if (objet.hasOwnProperty('media') && objet.media !== media && objet.media !== '' && objet.type !== 'embed') {
												supprimerFichier(mur, objet.media)
											}
											if (objet.hasOwnProperty('mediaExtra') && objet.mediaExtra !== mediaExtra && mediaExtra !== '' && await fs.pathExists(path.join(__dirname, '..', '/static/temp/' + mediaExtra))) {
												await fs.copy(path.join(__dirname, '..', '/static/temp/' + mediaExtra), path.join(__dirname, '..', '/static/' + definirDossierFichiers(mur) + '/' + mur + '/' + mediaExtra))
												await fs.remove(path.join(__dirname, '..', '/static/temp/' + mediaExtra))
											}
											if (objet.hasOwnProperty('mediaExtra') && objet.mediaExtra !== mediaExtra && objet.mediaExtra !== '') {
												supprimerFichier(mur, objet.mediaExtra)
											}
											if (objet.hasOwnProperty('medias')) {
												const mediasActuels = JSON.parse(objet.medias)
												for (let i = 0; i < medias.length; i++) {
													if (medias[i].hasOwnProperty('fichier') && medias[i].fichier !== '' && !mediasActuels.map(function (e) { return e.fichier }).includes(medias[i].fichier) && await fs.pathExists(path.join(__dirname, '..', '/static/temp/' + medias[i].fichier))) {
														await fs.copy(path.join(__dirname, '..', '/static/temp/' + medias[i].fichier), path.join(__dirname, '..', '/static/' + definirDossierFichiers(mur) + '/' + mur + '/' + medias[i].fichier))
														await fs.remove(path.join(__dirname, '..', '/static/temp/' + medias[i].fichier))
													}
												}
												mediasActuels.forEach(function (mediaActuel) {
													if (mediaActuel.hasOwnProperty('fichier') && !medias.map(function (e) { return e.fichier }).includes(mediaActuel.fichier)) {
														supprimerFichier(mur, mediaActuel.fichier)
													}
												})
											}
											if (objet.hasOwnProperty('vignette') && objet.vignette !== vignette && vignette !== '' && !vignette.includes('/img/') && !verifierURL(vignette, ['https', 'http']) && await fs.pathExists(path.join(__dirname, '..', '/static/temp/' + path.basename(vignette)))) {
												await fs.copy(path.join(__dirname, '..', '/static/temp/' + path.basename(vignette)), path.join(__dirname, '..', '/static' + vignette))
												await fs.remove(path.join(__dirname, '..', '/static/temp/' + path.basename(vignette)))
											}
											if (objet.hasOwnProperty('vignette') && objet.vignette !== vignette && objet.vignette.substring(1, definirDossierFichiers(mur).length + 1) === definirDossierFichiers(mur)) {
												supprimerVignette(objet.vignette)
											}
											io.in('mur-' + mur).emit('modifierbloc', { bloc: bloc, typeBloc: typeBloc, titre: titre, texte: texte, media: media, iframe: iframe, type: type, source: source, vignette: vignette, vignetteActivee: vignetteActivee, mediaExtra: mediaExtra, medias: medias, edition: edition, identifiant: identifiant, nom: nom, modifie: date, couleur: couleur, colonne: colonne, visibilite: visibilite })
											socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
											socket.request.session.save()
										}
									}
								})
							}
						})
					}
				})
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('copierbloc', function (bloc, typeBloc, mur, token, titre, texte, media, iframe, type, source, vignette, vignetteActivee, mediaExtra, medias, couleur, colonne, visibilite, identifiant, nom, murOrigine) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				db.hgetall('murs:' + mur, function (err, donnees) {
					if (err || !donnees || !donnees.hasOwnProperty('id') || !donnees.hasOwnProperty('token') || !donnees.hasOwnProperty('bloc')) { socket.emit('erreur'); return false }
					const id = parseInt(donnees.bloc) + 1
					db.hincrby('murs:' + mur, 'bloc', 1)
					if (donnees.id === mur && donnees.token === token) {
						const date = dayjs().format()
						const activiteId = parseInt(donnees.activite) + 1
						const multi = db.multi()
						if (vignetteActivee === true) {
							vignetteActivee = 'oui'
						} else {
							vignetteActivee = 'non'
						}
						let vignetteOrigine = ''
						if (vignette && vignette !== '' && !vignette.includes('/img/') && !verifierURL(vignette, ['https', 'http'])) {
							vignette = '/' + definirDossierFichiers(mur) + '/' + mur + '/' + path.basename(vignette)
							vignetteOrigine = '/' + definirDossierFichiers(murOrigine) + '/' + murOrigine + '/' + path.basename(vignette)
						}
						multi.hmset('contenu-blocs:' + mur + ':' + bloc, 'id', id, 'bloc', bloc, 'typeBloc', typeBloc, 'titre', titre, 'texte', texte, 'media', media, 'iframe', iframe, 'type', type, 'source', source, 'vignette', vignette, 'vignetteActivee', vignetteActivee, 'mediaExtra', mediaExtra, 'medias', JSON.stringify(medias), 'edition', 'oui', 'date', date, 'identifiant', identifiant, 'commentaires', 0, 'evaluations', 0, 'colonne', colonne, 'visibilite', visibilite, 'couleur', couleur)
						multi.zadd('blocs:' + mur, id, bloc)
						multi.hset('dates-murs:' + mur, 'date', date)
						if (visibilite === 'visible') {
							// Enregistrer entrée du registre d'activité
							multi.hincrby('murs:' + mur, 'activite', 1)
							multi.zadd('activite:' + mur, activiteId, JSON.stringify({ id: activiteId, bloc: bloc, identifiant: identifiant, titre: titre, date: date, type: 'bloc-ajoute' }))
						}
						multi.exec(async function () {
							if (media !== '' && type !== 'embed' && await fs.pathExists(path.join(__dirname, '..', '/static/' + definirDossierFichiers(murOrigine) + '/' + murOrigine + '/' + media))) {
								await fs.copy(path.join(__dirname, '..', '/static/' + definirDossierFichiers(murOrigine) + '/' + murOrigine + '/' + media), path.join(__dirname, '..', '/static/' + definirDossierFichiers(mur) + '/' + mur + '/' + media))
							}
							if (mediaExtra !== '' && await fs.pathExists(path.join(__dirname, '..', '/static/' + definirDossierFichiers(murOrigine) + '/' + murOrigine + '/' + mediaExtra))) {
								await fs.copy(path.join(__dirname, '..', '/static/' + definirDossierFichiers(murOrigine) + '/' + murOrigine + '/' + mediaExtra), path.join(__dirname, '..', '/static/' + definirDossierFichiers(mur) + '/' + mur + '/' + mediaExtra))
							}
							for (let i = 0; i < medias.length; i++) {
								if (medias[i].fichier !== '' && await fs.pathExists(path.join(__dirname, '..', '/static/' + definirDossierFichiers(murOrigine) + '/' + murOrigine + '/' + medias[i].fichier))) {
									await fs.copy(path.join(__dirname, '..', '/static/' + definirDossierFichiers(murOrigine) + '/' + murOrigine + '/' + medias[i].fichier), path.join(__dirname, '..', '/static/' + definirDossierFichiers(mur) + '/' + mur + '/' + medias[i].fichier))
								}
							}
							if (vignette && vignette !== '' && !vignette.includes('/img/') && !verifierURL(vignette, ['https', 'http']) && await fs.pathExists(path.join(__dirname, '..', '/static' + vignetteOrigine))) {
								await fs.copy(path.join(__dirname, '..', '/static' + vignetteOrigine), path.join(__dirname, '..', '/static' + vignette))
							}
							io.in('mur-' + mur).emit('ajouterbloc', { bloc: bloc, typeBloc: typeBloc, titre: titre, texte: texte, media: media, iframe: iframe, type: type, source: source, vignette: vignette, vignetteActivee: vignetteActivee, mediaExtra: mediaExtra, medias: medias, edition: 'oui', identifiant: identifiant, nom: nom, date: date, couleur: couleur, commentaires: 0, evaluations: [], colonne: colonne, visibilite: visibilite, activiteId: activiteId })
							socket.emit('copierbloc')
							socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
							socket.request.session.save()
						})
					}
				})
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('verrouillerbloc', function (mur, bloc, colonne, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			db.exists('contenu-blocs:' + mur + ':' + bloc, function (err, resultat) {
				if (err) { socket.emit('erreur'); return false }
				if (resultat === 1) {
					db.hmset('contenu-blocs:' + mur + ':' + bloc, 'edition', 'non')
					io.in('mur-' + mur).emit('verrouillerbloc', { bloc: bloc, colonne: colonne, identifiant: identifiant })
					socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
					socket.request.session.save()
				}
			})
		})

		socket.on('deverrouillerbloc', function (mur, bloc, colonne, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			db.exists('contenu-blocs:' + mur + ':' + bloc, function (err, resultat) {
				if (err) { socket.emit('erreur'); return false }
				if (resultat === 1) {
					db.hmset('contenu-blocs:' + mur + ':' + bloc, 'edition', 'oui')
					io.in('mur-' + mur).emit('deverrouillerbloc', { bloc: bloc, colonne: colonne, identifiant: identifiant })
					socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
					socket.request.session.save()
				}
			})
		})

		socket.on('autoriserbloc', function (mur, token, item, indexBloc, indexBlocColonne, moderation, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				db.hgetall('murs:' + mur, function (err, donnees) {
					if (err || !donnees || !donnees.hasOwnProperty('id') || !donnees.hasOwnProperty('token')) { socket.emit('erreur'); return false }
					if (donnees.id === mur && donnees.token === token) {
						db.exists('contenu-blocs:' + mur + ':' + item.bloc, function (err, resultat) {
							if (err) { socket.emit('erreur'); return false }
							if (resultat === 1) {
								const date = dayjs().format()
								const activiteId = parseInt(donnees.activite) + 1
								const multi = db.multi()
								if (item.hasOwnProperty('modifie')) {
									multi.hdel('contenu-blocs:' + mur + ':' + item.bloc, 'modifie')
								}
								multi.hmset('contenu-blocs:' + mur + ':' + item.bloc, 'visibilite', 'visible', 'date', date)
								multi.hset('dates-murs:' + mur, 'date', date)
								// Enregistrer entrée du registre d'activité
								multi.hincrby('murs:' + mur, 'activite', 1)
								multi.zadd('activite:' + mur, activiteId, JSON.stringify({ id: activiteId, bloc: item.bloc, identifiant: item.identifiant, titre: item.titre, date: date, type: 'bloc-ajoute' }))
								multi.exec(function () {
									io.in('mur-' + mur).emit('autoriserbloc', { bloc: item.bloc, typeBloc: item.typeBloc, titre: item.titre, texte: item.texte, media: item.media, iframe: item.iframe, type: item.type, source: item.source, vignette: item.vignette, vignetteActivee: item.vignetteActivee, mediaExtra: item.mediaExtra, medias: item.medias, edition: item.edition, identifiant: item.identifiant, nom: item.nom, date: date, couleur: item.couleur, commentaires: 0, evaluations: [], colonne: item.colonne, visibilite: 'visible', activiteId: activiteId, moderation: moderation, admin: identifiant, indexBloc: indexBloc, indexBlocColonne: indexBlocColonne })
									socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
									socket.request.session.save()
								})
							}
						})
					}
				})
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('deplacerbloc', function (items, mur, affichage, ordre, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				if (ordre === 'decroissant') {
					items.reverse()
				}
				const donneesBlocs = []
				for (let i = 0; i < items.length; i++) {
					const donneeBloc = new Promise(function (resolve) {
						db.exists('contenu-blocs:' + mur + ':' + items[i].bloc, function (err, resultat) {
							if (err) { resolve('erreur') }
							if (resultat === 1) {
								const multi = db.multi()
								multi.zrem('blocs:' + mur, items[i].bloc)
								multi.zadd('blocs:' + mur, (i + 1), items[i].bloc)
								if (affichage === 'colonnes') {
									multi.hset('contenu-blocs:' + mur + ':' + items[i].bloc, 'colonne', items[i].colonne)
								}
								multi.exec(function (err) {
									if (err) { resolve('erreur') }
									resolve(i)
								})
							} else {
								resolve('erreur')
							}
						})
					})
					donneesBlocs.push(donneeBloc)
				}
				Promise.all(donneesBlocs).then(function (blocs) {
					let erreurs = 0
					blocs.forEach(function (bloc) {
						if (bloc === 'erreur') {
							erreurs++
						}
					})
					if (erreurs === 0) {
						if (ordre === 'decroissant') {
							items.reverse()
						}
						io.in('mur-' + mur).emit('deplacerbloc', { blocs: items, identifiant: identifiant })
					} else {
						socket.emit('erreur')
					}
				})
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('supprimerbloc', function (bloc, mur, token, titre, colonne, identifiant, nom) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				db.hgetall('murs:' + mur, function (err, donnees) {
					if (err || !donnees || !donnees.hasOwnProperty('id') || !donnees.hasOwnProperty('token')) { socket.emit('erreur'); return false }
					if (donnees.id === mur && donnees.token === token) {
						const proprietaire = donnees.identifiant
						const admins = donnees.admins
						db.exists('contenu-blocs:' + mur + ':' + bloc, function (err, resultat) {
							if (err) { socket.emit('erreur'); return false }
							if (resultat === 1) {
								db.hgetall('contenu-blocs:' + mur + ':' + bloc, function (err, objet) {
									if (err) { socket.emit('erreur'); return false }
									if (objet.hasOwnProperty('media') && objet.media !== '' && objet.type !== 'embed') {
										supprimerFichier(mur, objet.media)
									}
									if (objet.hasOwnProperty('mediaExtra') && objet.mediaExtra !== '') {
										supprimerFichier(mur, objet.mediaExtra)
									}
									if (objet.hasOwnProperty('medias')) {
										const medias = JSON.parse(objet.medias)
										for (let i = 0; i < medias.length; i++) {
											if (medias[i].hasOwnProperty('fichier')) {
												supprimerFichier(mur, medias[i].fichier)
											}
										}
									}
									if (objet.hasOwnProperty('vignette') && objet.vignette !== '' && objet.vignette.substring(1, definirDossierFichiers(mur).length + 1) === definirDossierFichiers(mur)) {
										supprimerVignette(objet.vignette)
									}
									let pad = ''
									if (objet.hasOwnProperty('iframe') && objet.iframe !== '' && objet.iframe.includes(etherpad)) {
										pad = objet.iframe
									}
									if (objet.hasOwnProperty('media') && objet.media !== '' && objet.media.includes(etherpad) && pad === '') {
										pad = objet.media
									}
									if (objet.hasOwnProperty('bloc') && objet.bloc === bloc && (objet.identifiant === identifiant || proprietaire === identifiant || admins.includes(identifiant))) {
										const date = dayjs().format()
										const activiteId = parseInt(donnees.activite) + 1
										const multi = db.multi()
										multi.del('contenu-blocs:' + mur + ':' + bloc)
										multi.zrem('blocs:' + mur, bloc)
										multi.del('commentaires:' + bloc)
										multi.del('evaluations:' + bloc)
										multi.hset('dates-murs:' + mur, 'date', date)
										// Enregistrer entrée du registre d'activité
										multi.hincrby('murs:' + mur, 'activite', 1)
										multi.zadd('activite:' + mur, activiteId, JSON.stringify({ id: activiteId, bloc: bloc, identifiant: identifiant, titre: titre, date: date, type: 'bloc-supprime' }))
										multi.exec(function () {
											io.in('mur-' + mur).emit('supprimerbloc', { bloc: bloc, identifiant: identifiant, nom: nom, titre: titre, date: date, colonne: colonne, activiteId: activiteId, etherpad: pad })
											socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
											socket.request.session.save()
										})
									}
								})
							}
						})
					}
				})
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('commenterbloc', function (bloc, mur, titre, texte, identifiant, nom) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				db.hgetall('murs:' + mur, function (err, resultat) {
					if (err || !resultat || !resultat.hasOwnProperty('activite')) { socket.emit('erreur'); return false }
					db.hgetall('contenu-blocs:' + mur + ':' + bloc, function (err, donnees) {
						if (err || !donnees || !donnees.hasOwnProperty('commentaires')) { socket.emit('erreur'); return false }
						db.zcard('commentaires:' + bloc, function (err, commentaires) {
							if (err) { socket.emit('erreur'); return false }
							const date = dayjs().format()
							const activiteId = parseInt(resultat.activite) + 1
							const commentaireId = parseInt(donnees.commentaires) + 1
							const multi = db.multi()
							const commentaire = { id: commentaireId, identifiant: identifiant, date: date, texte: texte }
							multi.hincrby('contenu-blocs:' + mur + ':' + bloc, 'commentaires', 1)
							multi.hset('dates-murs:' + mur, 'date', date)
							multi.zadd('commentaires:' + bloc, commentaireId, JSON.stringify(commentaire))
							// Enregistrer entrée du registre d'activité
							multi.hincrby('murs:' + mur, 'activite', 1)
							multi.zadd('activite:' + mur, activiteId, JSON.stringify({ id: activiteId, bloc: bloc, identifiant: identifiant, titre: titre, date: date, type: 'bloc-commente' }))
							multi.exec(function () {
								io.in('mur-' + mur).emit('commenterbloc', { id: commentaireId, bloc: bloc, identifiant: identifiant, nom: nom, texte: texte, titre: titre, date: date, commentaires: parseInt(commentaires) + 1, activiteId: activiteId })
								socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
								socket.request.session.save()
							})
						})
					})
				})
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifiercommentaire', function (bloc, mur, id, texte, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				db.zrangebyscore('commentaires:' + bloc, id, id, function (err, resultats) {
					if (err || !resultats) { socket.emit('erreur'); return false }
					const dateModification = dayjs().format()
					const donnees = JSON.parse(resultats)
					const date = donnees.date
					const commentaire = { id: id, identifiant: donnees.identifiant, date: date, modifie: dateModification, texte: texte }
					const multi = db.multi()
					multi.zremrangebyscore('commentaires:' + bloc, id, id)
					multi.zadd('commentaires:' + bloc, id, JSON.stringify(commentaire))
					multi.hset('dates-murs:' + mur, 'date', dateModification)
					multi.exec(function () {
						io.in('mur-' + mur).emit('modifiercommentaire', { id: id, texte: texte })
						socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
						socket.request.session.save()
					})
				})
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('supprimercommentaire', function (bloc, mur, id, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				const date = dayjs().format()
				const multi = db.multi()
				multi.zremrangebyscore('commentaires:' + bloc, id, id)
				multi.hset('dates-murs:' + mur, 'date', date)
				multi.exec(function () {
					db.zcard('commentaires:' + bloc, function (err, commentaires) {
						if (err) { socket.emit('erreur'); return false }
						io.in('mur-' + mur).emit('supprimercommentaire', { id: id, bloc: bloc, commentaires: commentaires })
						socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
						socket.request.session.save()
					})
				})
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('commentaires', function (bloc, type) {
			const donneesCommentaires = []
			db.zrange('commentaires:' + bloc, 0, -1, function (err, commentaires) {
				if (err) { socket.emit('erreur'); return false }
				for (let commentaire of commentaires) {
					commentaire = JSON.parse(commentaire)
					const donneeCommentaire = new Promise(function (resolve) {
						const identifiant = commentaire.identifiant
						db.exists('utilisateurs:' + identifiant, function (err, resultat) {
							if (err) { resolve() }
							if (resultat === 1) {
								db.hgetall('utilisateurs:' + identifiant, function (err, utilisateur) {
									if (err) { resolve() }
									commentaire.nom = utilisateur.nom
									resolve(commentaire)
								})
							} else {
								db.exists('noms:' + identifiant, function (err, resultat) {
									if (err) { resolve() }
									if (resultat === 1) {
										db.hget('noms:' + identifiant, 'nom', function (err, nom) {
											if (err) { resolve() }
											commentaire.nom = nom
											resolve(commentaire)
										})
									} else {
										commentaire.nom = ''
										resolve(commentaire)
									}
								})
							}
						})
					})
					donneesCommentaires.push(donneeCommentaire)
				}
				Promise.all(donneesCommentaires).then(function (resultat) {
					socket.emit('commentaires', { commentaires: resultat.reverse(), type: type })
				})
			})
		})

		socket.on('evaluerbloc', function (bloc, mur, titre, etoiles, identifiant, nom) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				db.hgetall('murs:' + mur, function (err, resultat) {
					if (err || !resultat || !resultat.hasOwnProperty('activite')) { socket.emit('erreur'); return false }
					db.hgetall('contenu-blocs:' + mur + ':' + bloc, function (err, donnees) {
						if (err || !donnees || !donnees.hasOwnProperty('evaluations')) { socket.emit('erreur'); return false }
						const date = dayjs().format()
						const activiteId = parseInt(resultat.activite) + 1
						const evaluationId = parseInt(donnees.evaluations) + 1
						const evaluation = { id: evaluationId, identifiant: identifiant, date: date, etoiles: etoiles }
						const multi = db.multi()
						multi.hincrby('contenu-blocs:' + mur + ':' + bloc, 'evaluations', 1)
						multi.zadd('evaluations:' + bloc, evaluationId, JSON.stringify(evaluation))
						multi.hset('dates-murs:' + mur, 'date', date)
						// Enregistrer entrée du registre d'activité
						multi.hincrby('murs:' + mur, 'activite', 1)
						multi.zadd('activite:' + mur, activiteId, JSON.stringify({ id: activiteId, bloc: bloc, identifiant: identifiant, titre: titre, date: date, type: 'bloc-evalue' }))
						multi.exec(function () {
							io.in('mur-' + mur).emit('evaluerbloc', { id: evaluationId, bloc: bloc, identifiant: identifiant, nom: nom, titre: titre, date: date, evaluation: evaluation, activiteId: activiteId })
							socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
							socket.request.session.save()
						})
					})
				})
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifierevaluation', function (bloc, mur, id, etoiles, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				db.zrangebyscore('evaluations:' + bloc, id, id, function (err) {
					if (err) { socket.emit('erreur'); return false }
					const date = dayjs().format()
					const evaluation = { id: id, identifiant: identifiant, date: date, etoiles: etoiles }
					const multi = db.multi()
					multi.zremrangebyscore('evaluations:' + bloc, id, id)
					multi.zadd('evaluations:' + bloc, id, JSON.stringify(evaluation))
					multi.hset('dates-murs:' + mur, 'date', date)
					multi.exec(function () {
						io.in('mur-' + mur).emit('modifierevaluation', { id: id, bloc: bloc, date: date, etoiles: etoiles })
						socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
						socket.request.session.save()
					})
				})
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('supprimerevaluation', function (bloc, mur, id, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				const date = dayjs().format()
				const multi = db.multi()
				multi.hset('dates-murs:' + mur, 'date', date)
				multi.zremrangebyscore('evaluations:' + bloc, id, id)
				multi.exec(function () {
					io.in('mur-' + mur).emit('supprimerevaluation', { id: id, bloc: bloc })
					socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
					socket.request.session.save()
				})
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifiernom', function (mur, nom, statut, identifiant) {
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				if (statut === 'invite') {
					db.hset('noms:' + identifiant, 'nom', nom, function (err) {
						if (err) { socket.emit('erreur'); return false }
						io.in('mur-' + mur).emit('modifiernom', { identifiant: identifiant, nom: nom })
						socket.request.session.nom = nom
						socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
						socket.request.session.save()
					})
				} else if (statut === 'auteur') {
					db.hset('utilisateurs:' + identifiant, 'nom', nom, function (err) {
						if (err) { socket.emit('erreur'); return false }
						io.in('mur-' + mur).emit('modifiernom', { identifiant: identifiant, nom: nom })
						socket.request.session.nom = nom
						socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
						socket.request.session.save()
					})
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifiertitre', function (mur, titre, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				db.hset('murs:' + mur, 'titre', titre, function (err) {
					if (err) { socket.emit('erreur'); return false }
					const slug = definirSlug(titre)
					io.in('mur-' + mur).emit('modifiertitre', { titre: titre, slug: slug, identifiant: identifiant })
					socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
					socket.request.session.save()
				})
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifiercodeacces', function (mur, code, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				db.hset('murs:' + mur, 'code', code, function (err) {
					if (err) { socket.emit('erreur'); return false }
					io.in('mur-' + mur).emit('modifiercodeacces', code, identifiant)
					socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
					socket.request.session.save()
				})
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifieradmins', function (mur, admins, motdepasseAdmin, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				db.hgetall('murs:' + mur, async function (err, donnees) {
					if (err) { socket.emit('erreur'); return false }
					if (donnees.hasOwnProperty('motdepasse') && await bcrypt.compare(motdepasseAdmin, donnees.motdepasse)) {
						socket.emit('motsdepasseidentiques')
						socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
						socket.request.session.save()
					} else {
						const listeAdmins = JSON.parse(donnees.admins)
						const multi = db.multi()
						multi.hmset('murs:' + mur, 'admins', JSON.stringify(admins), 'motdepasseAdmin', motdepasseAdmin)
						admins.forEach(function (admin) {
							if (!listeAdmins.includes(admin)) {
								multi.sadd('murs-admins:' + admin, mur)
							}
						})
						listeAdmins.forEach(function (admin) {
							if (!admins.includes(admin)) {
								multi.srem('murs-admins:' + admin, mur)
							}
						})
						multi.exec(function () {
							io.in('mur-' + mur).emit('modifieradmins', admins, motdepasseAdmin, identifiant)
							socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
							socket.request.session.save()
						})
					}
				})
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifieracces', function (mur, acces, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				db.hgetall('murs:' + mur, function (err, donnees) {
					if (err) { socket.emit('erreur'); return false }
					let code = ''
					if (donnees && donnees.hasOwnProperty('code') && donnees.code !== '') {
						code = donnees.code
					} else {
						code = Math.floor(1000 + Math.random() * 9000)
					}
					db.hmset('murs:' + mur, 'acces', acces, 'code', code, function (err) {
						if (err) { socket.emit('erreur'); return false }
						io.in('mur-' + mur).emit('modifieracces', { acces: acces, code: code })
						socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
						socket.request.session.save()
					})
				})
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifiercontributions', function (mur, contributions, contributionsPrecedentes, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				db.hset('murs:' + mur, 'contributions', contributions, function (err) {
					if (err) { socket.emit('erreur'); return false }
					io.in('mur-' + mur).emit('modifiercontributions', { contributions: contributions, contributionsPrecedentes: contributionsPrecedentes })
					socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
					socket.request.session.save()
				})
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifieraffichage', function (mur, affichage, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				db.hset('murs:' + mur, 'affichage', affichage, function (err) {
					if (err) { socket.emit('erreur'); return false }
					io.in('mur-' + mur).emit('modifieraffichage', affichage, identifiant)
					socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
					socket.request.session.save()
				})
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifierordre', function (mur, ordre, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				db.hset('murs:' + mur, 'ordre', ordre, function (err) {
					if (err) { socket.emit('erreur'); return false }
					io.in('mur-' + mur).emit('modifierordre', ordre, identifiant)
					socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
					socket.request.session.save()
				})
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifierlargeur', function (mur, largeur, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				db.hset('murs:' + mur, 'largeur', largeur, function (err) {
					if (err) { socket.emit('erreur'); return false }
					io.in('mur-' + mur).emit('modifierlargeur', largeur, identifiant)
					socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
					socket.request.session.save()
				})
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifierfond', function (mur, fond, ancienfond, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				db.hset('murs:' + mur, 'fond', fond, async function (err) {
					if (err) { socket.emit('erreur'); return false }
					io.in('mur-' + mur).emit('modifierfond', fond, identifiant)
					if (ancienfond.substring(1, definirDossierFichiers(mur).length + 1) === definirDossierFichiers(mur)) {
						const chemin = path.join(__dirname, '..', '/static' + ancienfond)
						await fs.remove(chemin)
					}
					socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
					socket.request.session.save()
				})
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifiercouleurfond', function (mur, fond, ancienfond, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				db.hset('murs:' + mur, 'fond', fond, async function (err) {
					if (err) { socket.emit('erreur'); return false }
					io.in('mur-' + mur).emit('modifiercouleurfond', fond, identifiant)
					if (ancienfond.substring(1, definirDossierFichiers(mur).length + 1) === definirDossierFichiers(mur)) {
						const chemin = path.join(__dirname, '..', '/static' + ancienfond)
						await fs.remove(chemin)
					}
					socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
					socket.request.session.save()
				})
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifieractivite', function (mur, statut, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				db.hset('murs:' + mur, 'registreActivite', statut, function () {
					io.in('mur-' + mur).emit('modifieractivite', statut)
					socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
					socket.request.session.save()
				})
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifierconversation', function (mur, statut, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				db.hset('murs:' + mur, 'conversation', statut, function () {
					io.in('mur-' + mur).emit('modifierconversation', statut, identifiant)
					socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
					socket.request.session.save()
				})
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifierlisteutilisateurs', function (mur, statut, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				db.hset('murs:' + mur, 'listeUtilisateurs', statut, function () {
					io.in('mur-' + mur).emit('modifierlisteutilisateurs', statut, identifiant)
					socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
					socket.request.session.save()
				})
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifiereditionnom', function (mur, statut, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				db.hset('murs:' + mur, 'editionNom', statut, function () {
					io.in('mur-' + mur).emit('modifiereditionnom', statut, identifiant)
					socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
					socket.request.session.save()
				})
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifierfichiers', function (mur, statut, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				db.hset('murs:' + mur, 'fichiers', statut, function () {
					io.in('mur-' + mur).emit('modifierfichiers', statut, identifiant)
					socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
					socket.request.session.save()
				})
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifierenregistrements', function (mur, statut, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				db.hset('murs:' + mur, 'enregistrements', statut, function () {
					io.in('mur-' + mur).emit('modifierenregistrements', statut, identifiant)
					socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
					socket.request.session.save()
				})
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifierliens', function (mur, statut, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				db.hset('murs:' + mur, 'liens', statut, function () {
					io.in('mur-' + mur).emit('modifierliens', statut, identifiant)
					socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
					socket.request.session.save()
				})
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifierdocuments', function (mur, statut, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				db.hset('murs:' + mur, 'documents', statut, function () {
					io.in('mur-' + mur).emit('modifierdocuments', statut, identifiant)
					socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
					socket.request.session.save()
				})
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifiercommentaires', function (mur, statut, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				db.hset('murs:' + mur, 'commentaires', statut, function () {
					io.in('mur-' + mur).emit('modifiercommentaires', statut, identifiant)
					socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
					socket.request.session.save()
				})
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifierevaluations', function (mur, statut, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				db.hset('murs:' + mur, 'evaluations', statut, function () {
					io.in('mur-' + mur).emit('modifierevaluations', statut, identifiant)
					socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
					socket.request.session.save()
				})
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifierverrouillage', function (mur, statut, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				db.hset('murs:' + mur, 'verrouillage', statut, function () {
					io.in('mur-' + mur).emit('modifierverrouillage', statut, identifiant)
					socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
					socket.request.session.save()
				})
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifiercopiebloc', function (mur, statut, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				db.hset('murs:' + mur, 'copieBloc', statut, function () {
					io.in('mur-' + mur).emit('modifiercopiebloc', statut, identifiant)
					socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
					socket.request.session.save()
				})
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('messagechat', function (mur, texte, identifiant, nom) {
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				const date = dayjs().format()
				io.in('mur-' + mur).emit('messagechat', { texte: texte, identifiant: identifiant, nom: nom, date: date })
				socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
				socket.request.session.save()
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('reinitialisermessages', function (mur, identifiant) {
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				io.in('mur-' + mur).emit('reinitialisermessages', identifiant)
				socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
				socket.request.session.save()
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('reinitialiseractivite', function (mur, identifiant) {
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				db.del('activite:' + mur, function () {
					io.in('mur-' + mur).emit('reinitialiseractivite', identifiant)
					socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
					socket.request.session.save()
				})
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('ajoutercolonne', function (mur, titre, colonnes, affichageColonnes, identifiant, nom) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				db.hgetall('murs:' + mur, function (err, resultat) {
					if (err || !resultat || !resultat.hasOwnProperty('activite')) { socket.emit('erreur'); return false }
					const date = dayjs().format()
					const activiteId = parseInt(resultat.activite) + 1
					colonnes.push(titre)
					affichageColonnes.push(true)
					const multi = db.multi()
					multi.hmset('murs:' + mur, 'colonnes', JSON.stringify(colonnes), 'affichageColonnes', JSON.stringify(affichageColonnes))
					// Enregistrer entrée du registre d'activité
					multi.hincrby('murs:' + mur, 'activite', 1)
					multi.zadd('activite:' + mur, activiteId, JSON.stringify({ id: activiteId, identifiant: identifiant, titre: titre, date: date, type: 'colonne-ajoutee' }))
					multi.exec(function () {
						io.in('mur-' + mur).emit('ajoutercolonne', { identifiant: identifiant, nom: nom, titre: titre, colonnes: colonnes, affichageColonnes: affichageColonnes, date: date, activiteId: activiteId })
						socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
						socket.request.session.save()
					})
				})
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifiertitrecolonne', function (mur, titre, index, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				db.hgetall('murs:' + mur, function (err, donnees) {
					if (err) { socket.emit('erreur'); return false }
					const colonnes = JSON.parse(donnees.colonnes)
					colonnes[index] = titre
					db.hset('murs:' + mur, 'colonnes', JSON.stringify(colonnes), function () {
						io.in('mur-' + mur).emit('modifiertitrecolonne', colonnes, identifiant)
						socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
						socket.request.session.save()
					})
				})
			} else {
				socket.emit('deconnecte')
			}
		})
		
		socket.on('modifieraffichagecolonne', function (mur, valeur, index, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				db.hgetall('murs:' + mur, function (err, donnees) {
					if (err || !donnees) { socket.emit('erreur'); return false }
					let affichageColonnes = []
					if (donnees.hasOwnProperty('affichageColonnes')) {
						affichageColonnes = JSON.parse(donnees.affichageColonnes)
					} else {
						const colonnes = JSON.parse(donnees.colonnes)
						colonnes.forEach(function () {
							affichageColonnes.push(true)
						})
					}
					affichageColonnes[index] = valeur
					db.hset('murs:' + mur, 'affichageColonnes', JSON.stringify(affichageColonnes), function () {
						io.in('mur-' + mur).emit('modifieraffichagecolonne', affichageColonnes, identifiant)
						socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
						socket.request.session.save()
					})
				})
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('supprimercolonne', function (mur, titre, colonne, identifiant, nom) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				db.hgetall('murs:' + mur, function (err, donnees) {
					if (err || !donnees || !donnees.hasOwnProperty('colonnes')) { socket.emit('erreur'); return false }
					const colonnes = JSON.parse(donnees.colonnes)
					colonnes.splice(colonne, 1)
					const affichageColonnes = JSON.parse(donnees.affichageColonnes)
					affichageColonnes.splice(colonne, 1)
					const donneesBlocs = []
					db.zrange('blocs:' + mur, 0, -1, function (err, blocs) {
						if (err) { socket.emit('erreur'); return false }
						for (const bloc of blocs) {
							const donneesBloc = new Promise(function (resolve) {
								db.hgetall('contenu-blocs:' + mur + ':' + bloc, function (err, resultat) {
									if (err) { resolve({}) }
									resolve(resultat)
								})
							})
							donneesBlocs.push(donneesBloc)
						}
						Promise.all(donneesBlocs).then(function (blocs) {
							const blocsSupprimes = []
							const blocsRestants = []
							blocs.forEach(function (item) {
								if (item && item.hasOwnProperty('colonne') && parseInt(item.colonne) === parseInt(colonne)) {
									blocsSupprimes.push(item.bloc)
								} else if (item) {
									blocsRestants.push(item)
								}
							})
							const donneesBlocsSupprimes = []
							for (const blocSupprime of blocsSupprimes) {
								const donneesBlocSupprime = new Promise(function (resolve) {
									db.exists('contenu-blocs:' + mur + ':' + blocSupprime, function (err, resultat) {
										if (err) { resolve() }
										if (resultat === 1) {
											db.hgetall('contenu-blocs:' + mur + ':' + blocSupprime, function (err, objet) {
												if (err) { resolve() }
												if (objet.hasOwnProperty('media') && objet.media !== '' && objet.type !== 'embed') {
													supprimerFichier(mur, objet.media)
												}
												if (objet.hasOwnProperty('mediaExtra') && objet.mediaExtra !== '') {
													supprimerFichier(mur, objet.mediaExtra)
												}
												if (objet.hasOwnProperty('medias')) {
													const medias = JSON.parse(objet.medias)
													for (let i = 0; i < medias.length; i++) {
														if (medias[i].hasOwnProperty('fichier')) {
															supprimerFichier(mur, medias[i].fichier)
														}
													}
												}
												if (objet.hasOwnProperty('vignette') && objet.vignette !== '' && objet.vignette.substring(1, definirDossierFichiers(mur).length + 1) === definirDossierFichiers(mur)) {
													supprimerVignette(objet.vignette)
												}
												if (objet.hasOwnProperty('bloc') && objet.bloc === blocSupprime) {
													const multi = db.multi()
													multi.del('contenu-blocs:' + mur + ':' + blocSupprime)
													multi.zrem('blocs:' + mur, blocSupprime)
													multi.del('commentaires:' + blocSupprime)
													multi.del('evaluations:' + blocSupprime)
													multi.exec(function (err) {
														if (err) { resolve() }
														resolve('supprime')
													})
												} else {
													resolve()
												}
											})
										} else {
											resolve()
										}
									})
								})
								donneesBlocsSupprimes.push(donneesBlocSupprime)
							}
							const donneesBlocsRestants = []
							for (let i = 0; i < blocsRestants.length; i++) {
								const donneeBloc = new Promise(function (resolve) {
									if (parseInt(blocsRestants[i].colonne) > parseInt(colonne)) {
										db.hset('contenu-blocs:' + mur + ':' + blocsRestants[i].bloc, 'colonne', (parseInt(blocsRestants[i].colonne) - 1), function (err) {
											if (err) { resolve() }
											resolve(i)
										})
									} else {
										resolve(i)
									}
								})
								donneesBlocsRestants.push(donneeBloc)
							}
							Promise.all([donneesBlocsSupprimes, donneesBlocsRestants]).then(function () {
								const date = dayjs().format()
								const activiteId = parseInt(donnees.activite) + 1
								const multi = db.multi()
								multi.hmset('murs:' + mur, 'colonnes', JSON.stringify(colonnes), 'affichageColonnes', JSON.stringify(affichageColonnes))
								// Enregistrer entrée du registre d'activité
								multi.hincrby('murs:' + mur, 'activite', 1)
								multi.zadd('activite:' + mur, activiteId, JSON.stringify({ id: activiteId, identifiant: identifiant, titre: titre, date: date, type: 'colonne-supprimee' }))
								multi.exec(function () {
									io.in('mur-' + mur).emit('supprimercolonne', { identifiant: identifiant, nom: nom, titre: titre, colonne: colonne, colonnes: colonnes, affichageColonnes: affichageColonnes, date: date, activiteId: activiteId })
									socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
									socket.request.session.save()
								})
							})
						})
					})
				})
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('deplacercolonne', function (mur, titre, affichage, direction, colonne, identifiant, nom) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				db.hgetall('murs:' + mur, function (err, donnees) {
					if (err || !donnees || !donnees.hasOwnProperty('colonnes')) { socket.emit('erreur'); return false }
					const colonnes = JSON.parse(donnees.colonnes)
					const affichageColonnes = JSON.parse(donnees.affichageColonnes)
					if (direction === 'gauche') {
						colonnes.splice((parseInt(colonne) - 1), 0, titre)
						colonnes.splice((parseInt(colonne) + 1), 1)
						affichageColonnes.splice((parseInt(colonne) - 1), 0, affichage)
						affichageColonnes.splice((parseInt(colonne) + 1), 1)
					} else if (direction === 'droite') {
						const titreDeplace = colonnes[parseInt(colonne) + 1]
						colonnes.splice((parseInt(colonne) + 1), 0, titre)
						colonnes.splice(parseInt(colonne), 1, titreDeplace)
						colonnes.splice((parseInt(colonne) + 2), 1)
						const affichageDeplace = affichageColonnes[parseInt(colonne) + 1]
						affichageColonnes.splice((parseInt(colonne) + 1), 0, affichage)
						affichageColonnes.splice(parseInt(colonne), 1, affichageDeplace)
						affichageColonnes.splice((parseInt(colonne) + 2), 1)
					}
					const donneesBlocs = []
					db.zrange('blocs:' + mur, 0, -1, function (err, blocs) {
						if (err) { socket.emit('erreur'); return false }
						for (const bloc of blocs) {
							const donneesBloc = new Promise(function (resolve) {
								db.hgetall('contenu-blocs:' + mur + ':' + bloc, function (err, resultat) {
									if (err) { resolve({}) }
									resolve(resultat)
								})
							})
							donneesBlocs.push(donneesBloc)
						}
						Promise.all(donneesBlocs).then(function (items) {
							const donneesBlocsDeplaces = []
							for (const item of items) {
								const donneesBlocDeplace = new Promise(function (resolve) {
									if (item && item.hasOwnProperty('bloc')) {
										db.exists('contenu-blocs:' + mur + ':' + item.bloc, function (err, resultat) {
											if (err) { resolve() }
											if (resultat === 1 && parseInt(item.colonne) === parseInt(colonne) && direction === 'gauche') {
												db.hset('contenu-blocs:' + mur + ':' + item.bloc, 'colonne', (parseInt(colonne) - 1), function (err) {
													if (err) { resolve() }
													resolve('deplace')
												})
											} else if (resultat === 1 && parseInt(item.colonne) === parseInt(colonne) && direction === 'droite') {
												db.hset('contenu-blocs:' + mur + ':' + item.bloc, 'colonne', (parseInt(colonne) + 1), function (err) {
													if (err) { resolve() }
													resolve('deplace')
												})
											} else if (resultat === 1 && parseInt(item.colonne) === (parseInt(colonne) - 1) && direction === 'gauche') {
												db.hset('contenu-blocs:' + mur + ':' + item.bloc, 'colonne', parseInt(colonne), function (err) {
													if (err) { resolve() }
													resolve('deplace')
												})
											} else if (resultat === 1 && parseInt(item.colonne) === (parseInt(colonne) + 1) && direction === 'droite') {
												db.hset('contenu-blocs:' + mur + ':' + item.bloc, 'colonne', parseInt(colonne), function (err) {
													if (err) { resolve() }
													resolve('deplace')
												})
											} else {
												resolve()
											}
										})
									} else {
										resolve()
									}
								})
								donneesBlocsDeplaces.push(donneesBlocDeplace)
							}
							Promise.all(donneesBlocsDeplaces).then(function () {
								const date = dayjs().format()
								const activiteId = parseInt(donnees.activite) + 1
								const multi = db.multi()
								multi.hmset('murs:' + mur, 'colonnes', JSON.stringify(colonnes), 'affichageColonnes', JSON.stringify(affichageColonnes))
								// Enregistrer entrée du registre d'activité
								multi.hincrby('murs:' + mur, 'activite', 1)
								multi.zadd('activite:' + mur, activiteId, JSON.stringify({ id: activiteId, identifiant: identifiant, titre: titre, date: date, type: 'colonne-deplacee' }))
								multi.exec(function () {
									io.in('mur-' + mur).emit('deplacercolonne', { identifiant: identifiant, nom: nom, titre: titre, direction: direction, colonne: colonne, colonnes: colonnes, affichageColonnes: affichageColonnes, date: date, activiteId: activiteId })
									socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
									socket.request.session.save()
								})
							})
						})
					})
				})
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('debloquermur', function (identifiant, mur) {
			db.exists('utilisateurs:' + identifiant, function (err, resultat) {
				if (err) { socket.emit('erreur'); return false }
				if (resultat === 1) {
					db.hgetall('utilisateurs:' + identifiant, function (err, utilisateur) {
						if (err) { socket.emit('erreur'); return false }
						socket.request.session.identifiant = identifiant
						socket.request.session.nom = utilisateur.nom
						socket.request.session.statut = 'auteur'
						socket.request.session.langue = utilisateur.langue
						if (!socket.request.session.hasOwnProperty('murs')) {
							socket.request.session.murs = []
						}
						socket.request.session.murs.push(mur)
						if (!socket.request.session.hasOwnProperty('digidrive')) {
							socket.request.session.digidrive = []
						}
						socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
						socket.request.session.save()
						socket.emit('debloquermur', { identifiant: identifiant, nom: utilisateur.nom, langue: utilisateur.langue })
					})
				} else {
					socket.request.session.identifiant = identifiant
					socket.request.session.statut = 'auteur'
					if (!socket.request.session.hasOwnProperty('nom')) {
						if (identifiant.length === 13 && identifiant.substring(0, 1) === 'u') {
							socket.request.session.nom = identifiant.slice(0, 8).toUpperCase()
						} else {
							socket.request.session.nom = identifiant.toUpperCase()
						}
					}
					if (!socket.request.session.hasOwnProperty('langue')) {
						socket.request.session.langue = 'fr'
					}
					if (!socket.request.session.hasOwnProperty('murs')) {
						socket.request.session.murs = []
					}
					socket.request.session.murs.push(mur)
					if (!socket.request.session.hasOwnProperty('digidrive')) {
						socket.request.session.digidrive = []
					}
					socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
					socket.request.session.save()
					socket.emit('debloquermur', { identifiant: identifiant, nom: socket.request.session.nom, langue: socket.request.session.langue })
				}
			})
		})

		socket.on('modifiernotification', function (mur, admins) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			db.hgetall('murs:' + mur, function () {
				db.hset('murs:' + mur, 'notification', JSON.stringify(admins), function () {
					io.in('mur-' + mur).emit('modifiernotification', admins)
					socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
					socket.request.session.save()
				})
			})
		})

		socket.on('verifiermodifierbloc', function (mur, bloc, identifiant) {
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				socket.to('mur-' + mur).emit('verifiermodifierbloc', { bloc: bloc, identifiant: identifiant })
				socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
				socket.request.session.save()
			}
		})

		socket.on('reponsemodifierbloc', function (mur, identifiant, reponse) {
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				socket.to('mur-' + mur).emit('reponsemodifierbloc', { identifiant: identifiant, reponse: reponse })
				socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
				socket.request.session.save()
			}
		})

		socket.on('supprimeractivite', function (mur, id, identifiant) {
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				db.zremrangebyscore('activite:' + mur, id, id, function () {
					io.in('mur-' + mur).emit('supprimeractivite', id, identifiant)
					socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
					socket.request.session.save()
				})
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('murimporte', function (mur, identifiant) {
			if (identifiant !== '' && identifiant !== undefined && socket.request.session.identifiant === identifiant) {
				socket.to('mur-' + mur).emit('murimporte')
				socket.request.session.cookie.expires = new Date(Date.now() + dureeSession)
				socket.request.session.save()
			}
		})

		socket.on('modifierlangue', function (langue) {
			socket.request.session.langue = langue
			socket.request.session.save()
		})

		socket.on('verifiermaintenance', function () {
			socket.emit('verifiermaintenance', maintenance)
		})

		socket.on('activermaintenance', function () {
			maintenance = true
			socket.emit('verifiermaintenance', true)
		})

		socket.on('desactivermaintenance', function () {
			maintenance = false
			socket.emit('verifiermaintenance', false)
		})
	})

	function creerMur (res, id, token, slug, titre, date, identifiant) {
		const multi = db.multi()
		if (id === 1) {
			multi.set('mur', 1)
		} else {
			multi.incr('mur')
		}
		multi.hmset('murs:' + id, 'id', id, 'token', token, 'titre', titre, 'identifiant', identifiant, 'fond', '/img/fond7.png', 'acces', 'public', 'motdepasseAdmin', '', 'contributions', 'ouvertes', 'affichage', 'mur', 'registreActivite', 'active', 'conversation', 'desactivee', 'listeUtilisateurs', 'activee', 'editionNom', 'desactivee', 'fichiers', 'actives', 'enregistrements', 'desactives', 'liens', 'actives', 'documents', 'desactives', 'commentaires', 'desactives', 'evaluations', 'desactivees', 'verrouillage', 'desactive', 'copieBloc', 'desactivee', 'ordre', 'croissant', 'largeur', 'normale', 'date', date, 'colonnes', JSON.stringify([]), 'affichageColonnes', JSON.stringify([]), 'bloc', 0, 'activite', 0, 'admins', JSON.stringify([]), 'vues', 0)
		multi.sadd('murs-crees:' + identifiant, id)
		multi.sadd('utilisateurs-murs:' + id, identifiant)
		multi.hset('dates-murs:' + id, 'date', date)
		multi.exec(async function () {
			const chemin = path.join(__dirname, '..', '/static/' + definirDossierFichiers(id) + '/' + id)
			await fs.mkdirs(chemin)
			res.json({ id: id, token: token, slug: slug, titre: titre, identifiant: identifiant, fond: '/img/fond7.png', acces: 'public', motdepasseAdmin: '', contributions: 'ouvertes', affichage: 'mur', registreActivite: 'active', conversation: 'desactivee', listeUtilisateurs: 'activee', editionNom: 'desactivee', fichiers: 'actives', enregistrements: 'desactives', liens: 'actives', documents: 'desactives', commentaires: 'desactives', evaluations: 'desactivees', verrouillage: 'desactive', copieBloc: 'desactivee', ordre: 'croissant', largeur: 'normale', date: date, colonnes: [], affichageColonnes: [], bloc: 0, activite: 0, admins: [], vues: 0 })
		})
	}

	function creerMurSansCompte (req, res, id, token, slug, titre, hash, date, identifiant, nom, langue, type) {
		const multi = db.multi()
		if (id === 1) {
			multi.set('mur', 1)
		} else {
			multi.incr('mur')
		}
		multi.hmset('murs:' + id, 'id', id, 'token', token, 'titre', titre, 'identifiant', identifiant, 'motdepasse', hash, 'fond', '/img/fond7.png', 'acces', 'public', 'motdepasseAdmin', '', 'contributions', 'ouvertes', 'affichage', 'mur', 'registreActivite', 'active', 'conversation', 'desactivee', 'listeUtilisateurs', 'activee', 'editionNom', 'desactivee', 'fichiers', 'actives', 'enregistrements', 'desactives', 'liens', 'actives', 'documents', 'desactives', 'commentaires', 'desactives', 'evaluations', 'desactivees', 'verrouillage', 'desactive', 'copieBloc', 'desactivee', 'ordre', 'croissant', 'largeur', 'normale', 'date', date, 'colonnes', JSON.stringify([]), 'affichageColonnes', JSON.stringify([]), 'bloc', 0, 'activite', 0, 'admins', JSON.stringify([]), 'vues', 0)
		if (type === 'api') {
			multi.sadd('murs-crees:' + identifiant, id)
		}
		multi.hmset('utilisateurs:' + identifiant, 'id', identifiant, 'date', date, 'nom', nom, 'langue', langue)
		multi.exec(async function () {
			const chemin = path.join(__dirname, '..', '/static/' + definirDossierFichiers(id) + '/' + id)
			await fs.mkdirs(chemin)
			if (type === 'api') {
				res.send(id + '/' + token + '/' + slug)
			} else {
				req.session.langue = langue
				req.session.statut = 'auteur'
				req.session.cookie.expires = new Date(Date.now() + dureeSession)
				res.json({ id: id, token: token, slug: slug })
			}
		})
	}

	function recupererDonneesUtilisateur (identifiant) {
		// Murs créés
		const donneesMursCrees = new Promise(function (resolveMain) {
			db.smembers('murs-crees:' + identifiant, function (err, murs) {
				const donneesMurs = []
				if (err) { resolveMain(donneesMurs) }
				for (const mur of murs) {
					const donneeMur = new Promise(function (resolve) {
						db.exists('murs:' + mur, async function (err, resultat) {
							if (err) { resolve({}) }
							if (resultat === 1) {
								db.hgetall('murs:' + mur, function (err, donnees) {
									if (err) { resolve({}) }
									db.exists('utilisateurs:' + donnees.identifiant, function (err, resultat) {
										if (err) {
											donnees.nom = donnees.identifiant
											resolve(donnees)
										}
										if (resultat === 1) {
											db.hgetall('utilisateurs:' + donnees.identifiant, function (err, utilisateur) {
												if (err) {
													donnees.nom = donnees.identifiant
													resolve(donnees)
												}
												if (utilisateur.nom === '') {
													donnees.nom = donnees.identifiant
												} else {
													donnees.nom = utilisateur.nom
												}
												resolve(donnees)
											})
										} else {
											donnees.nom = donnees.identifiant
											resolve(donnees)
										}
									})
								})
							} else if (resultat !== 1 && await fs.pathExists(path.join(__dirname, '..', '/static/murs/mur-' + mur + '.json'))) {
								const donnees = await fs.readJson(path.join(__dirname, '..', '/static/murs/mur-' + mur + '.json'))
								if (typeof donnees === 'object' && donnees !== null && donnees.hasOwnProperty('identifiant')) {
									db.exists('utilisateurs:' + donnees.identifiant, function (err, resultat) {
										if (err) {
											donnees.nom = donnees.identifiant
											resolve(donnees)
										}
										if (resultat === 1) {
											db.hgetall('utilisateurs:' + donnees.identifiant, function (err, utilisateur) {
												if (err) {
													donnees.nom = donnees.identifiant
													resolve(donnees)
												}
												if (utilisateur.nom === '') {
													donnees.nom = donnees.identifiant
												} else {
													donnees.nom = utilisateur.nom
												}
												resolve(donnees)
											})
										} else {
											donnees.nom = donnees.identifiant
											resolve(donnees)
										}
									})
								} else {
									resolve({})
								}
							} else {
								resolve({})
							}
						})
					})
					donneesMurs.push(donneeMur)
				}
				Promise.all(donneesMurs).then(function (resultat) {
					resolveMain(resultat)
				})
			})
		})
		// Murs rejoints
		const donneesMursRejoints = new Promise(function (resolveMain) {
			db.smembers('murs-rejoints:' + identifiant, function (err, murs) {
				const donneesMurs = []
				if (err) { resolveMain(donneesMurs) }
				for (const mur of murs) {
					const donneeMur = new Promise(function (resolve) {
						db.exists('murs:' + mur, async function (err, resultat) {
							if (err) { resolve({}) }
							if (resultat === 1) {
								db.hgetall('murs:' + mur, function (err, donnees) {
									if (err) { resolve({}) }
									db.exists('utilisateurs:' + donnees.identifiant, function (err, resultat) {
										if (err) {
											donnees.nom = donnees.identifiant
											resolve(donnees)
										}
										if (resultat === 1) {
											db.hgetall('utilisateurs:' + donnees.identifiant, function (err, utilisateur) {
												if (err) {
													donnees.nom = donnees.identifiant
													resolve(donnees)
												}
												if (utilisateur.nom === '') {
													donnees.nom = donnees.identifiant
												} else {
													donnees.nom = utilisateur.nom
												}
												resolve(donnees)
											})
										} else {
											donnees.nom = donnees.identifiant
											resolve(donnees)
										}
									})
								})
							} else if (resultat !== 1 && await fs.pathExists(path.join(__dirname, '..', '/static/murs/mur-' + mur + '.json'))) {
								const donnees = await fs.readJson(path.join(__dirname, '..', '/static/murs/mur-' + mur + '.json'))
								if (typeof donnees === 'object' && donnees !== null && donnees.hasOwnProperty('identifiant')) {
									db.exists('utilisateurs:' + donnees.identifiant, function (err, resultat) {
										if (err) {
											donnees.nom = donnees.identifiant
											resolve(donnees)
										}
										if (resultat === 1) {
											db.hgetall('utilisateurs:' + donnees.identifiant, function (err, utilisateur) {
												if (err) {
													donnees.nom = donnees.identifiant
													resolve(donnees)
												}
												if (utilisateur.nom === '') {
													donnees.nom = donnees.identifiant
												} else {
													donnees.nom = utilisateur.nom
												}
												resolve(donnees)
											})
										} else {
											donnees.nom = donnees.identifiant
											resolve(donnees)
										}
									})
								} else {
									resolve({})
								}
							} else {
								resolve({})
							}
						})
					})
					donneesMurs.push(donneeMur)
				}
				Promise.all(donneesMurs).then(function (resultat) {
					resolveMain(resultat)
				})
			})
		})
		// Murs administrés
		const donneesMursAdmins = new Promise(function (resolveMain) {
			db.smembers('murs-admins:' + identifiant, function (err, murs) {
				const donneesMurs = []
				if (err) { resolveMain(donneesMurs) }
				for (const mur of murs) {
					const donneeMur = new Promise(function (resolve) {
						db.exists('murs:' + mur, async function (err, resultat) {
							if (err) { resolve({}) }
							if (resultat === 1) {
								db.hgetall('murs:' + mur, function (err, donnees) {
									if (err) { resolve({}) }
									db.exists('utilisateurs:' + donnees.identifiant, function (err, resultat) {
										if (err) {
											donnees.nom = donnees.identifiant
											resolve(donnees)
										}
										if (resultat === 1) {
											db.hgetall('utilisateurs:' + donnees.identifiant, function (err, utilisateur) {
												if (err) {
													donnees.nom = donnees.identifiant
													resolve(donnees)
												}
												if (utilisateur.nom === '') {
													donnees.nom = donnees.identifiant
												} else {
													donnees.nom = utilisateur.nom
												}
												resolve(donnees)
											})
										} else {
											donnees.nom = donnees.identifiant
											resolve(donnees)
										}
									})
								})
							} else if (resultat !== 1 && await fs.pathExists(path.join(__dirname, '..', '/static/murs/mur-' + mur + '.json'))) {
								const donnees = await fs.readJson(path.join(__dirname, '..', '/static/murs/mur-' + mur + '.json'))
								if (typeof donnees === 'object' && donnees !== null && donnees.hasOwnProperty('identifiant')) {
									db.exists('utilisateurs:' + donnees.identifiant, function (err, resultat) {
										if (err) {
											donnees.nom = donnees.identifiant
											resolve(donnees)
										}
										if (resultat === 1) {
											db.hgetall('utilisateurs:' + donnees.identifiant, function (err, utilisateur) {
												if (err) {
													donnees.nom = donnees.identifiant
													resolve(donnees)
												}
												if (utilisateur.nom === '') {
													donnees.nom = donnees.identifiant
												} else {
													donnees.nom = utilisateur.nom
												}
												resolve(donnees)
											})
										} else {
											donnees.nom = donnees.identifiant
											resolve(donnees)
										}
									})
								} else {
									resolve({})
								}
							} else {
								resolve({})
							}
						})
					})
					donneesMurs.push(donneeMur)
				}
				Promise.all(donneesMurs).then(function (resultat) {
					resolveMain(resultat)
				})
			})
		})
		// Murs favoris
		const donneesMursFavoris = new Promise(function (resolveMain) {
			db.smembers('murs-favoris:' + identifiant, function (err, murs) {
				const donneesMurs = []
				if (err) { resolveMain(donneesMurs) }
				for (const mur of murs) {
					const donneeMur = new Promise(function (resolve) {
						db.exists('murs:' + mur, async function (err, resultat) {
							if (err) { resolve({}) }
							if (resultat === 1) {
								db.hgetall('murs:' + mur, function (err, donnees) {
									if (err) { resolve({}) }
									db.exists('utilisateurs:' + donnees.identifiant, function (err, resultat) {
										if (err) {
											donnees.nom = donnees.identifiant
											resolve(donnees)
										}
										if (resultat === 1) {
											db.hgetall('utilisateurs:' + donnees.identifiant, function (err, utilisateur) {
												if (err) {
													donnees.nom = donnees.identifiant
													resolve(donnees)
												}
												if (utilisateur.nom === '') {
													donnees.nom = donnees.identifiant
												} else {
													donnees.nom = utilisateur.nom
												}
												resolve(donnees)
											})
										} else {
											donnees.nom = donnees.identifiant
											resolve(donnees)
										}
									})
								})
							} else if (resultat !== 1 && await fs.pathExists(path.join(__dirname, '..', '/static/murs/mur-' + mur + '.json'))) {
								const donnees = await fs.readJson(path.join(__dirname, '..', '/static/murs/mur-' + mur + '.json'))
								if (typeof donnees === 'object' && donnees !== null && donnees.hasOwnProperty('identifiant')) {
									db.exists('utilisateurs:' + donnees.identifiant, function (err, resultat) {
										if (err) {
											donnees.nom = donnees.identifiant
											resolve(donnees)
										}
										if (resultat === 1) {
											db.hgetall('utilisateurs:' + donnees.identifiant, function (err, utilisateur) {
												if (err) {
													donnees.nom = donnees.identifiant
													resolve(donnees)
												}
												if (utilisateur.nom === '') {
													donnees.nom = donnees.identifiant
												} else {
													donnees.nom = utilisateur.nom
												}
												resolve(donnees)
											})
										} else {
											donnees.nom = donnees.identifiant
											resolve(donnees)
										}
									})
								} else {
									resolve({})
								}
							} else {
								resolve({})
							}
						})
					})
					donneesMurs.push(donneeMur)
				}
				Promise.all(donneesMurs).then(function (resultat) {
					resolveMain(resultat)
				})
			})
		})
		return Promise.all([donneesMursCrees, donneesMursRejoints, donneesMursAdmins, donneesMursFavoris])
	}

	function recupererDonneesAuteur (identifiant) {
		// Murs créés
		const donneesMursCrees = new Promise(function (resolveMain) {
			db.smembers('murs-crees:' + identifiant, function (err, murs) {
				const donneesMurs = []
				if (err) { resolveMain(donneesMurs) }
				for (const mur of murs) {
					const donneeMur = new Promise(function (resolve) {
						db.exists('murs:' + mur, async function (err, resultat) {
							if (err) { resolve({}) }
							if (resultat === 1) {
								db.hgetall('murs:' + mur, function (err, donnees) {
									if (err) { resolve({}) }
									resolve(donnees)
								})
							} else if (resultat !== 1 && await fs.pathExists(path.join(__dirname, '..', '/static/murs/mur-' + mur + '.json'))) {
								const donnees = await fs.readJson(path.join(__dirname, '..', '/static/murs/mur-' + mur + '.json'))
								if (typeof donnees === 'object' && donnees !== null && donnees.hasOwnProperty('identifiant')) {
									resolve(donnees)
								} else {
									resolve({})
								}
							} else {
								resolve({})
							}
						})
					})
					donneesMurs.push(donneeMur)
				}
				Promise.all(donneesMurs).then(function (resultat) {
					resolveMain(resultat)
				})
			})
		})
		// Murs administrés
		const donneesMursAdmins = new Promise(function (resolveMain) {
			db.smembers('murs-admins:' + identifiant, function (err, murs) {
				const donneesMurs = []
				if (err) { resolveMain(donneesMurs) }
				for (const mur of murs) {
					const donneeMur = new Promise(function (resolve) {
						db.exists('murs:' + mur, async function (err, resultat) {
							if (err) { resolve({}) }
							if (resultat === 1) {
								db.hgetall('murs:' + mur, function (err, donnees) {
									if (err) { resolve({}) }
									resolve(donnees)
								})
							} else if (resultat !== 1 && await fs.pathExists(path.join(__dirname, '..', '/static/murs/mur-' + mur + '.json'))) {
								const donnees = await fs.readJson(path.join(__dirname, '..', '/static/murs/mur-' + mur + '.json'))
								if (typeof donnees === 'object' && donnees !== null && donnees.hasOwnProperty('identifiant')) {
									resolve(donnees)
								} else {
									resolve({})
								}
							} else {
								resolve({})
							}
						})
					})
					donneesMurs.push(donneeMur)
				}
				Promise.all(donneesMurs).then(function (resultat) {
					resolveMain(resultat)
				})
			})
		})
		return Promise.all([donneesMursCrees, donneesMursAdmins])
	}

	function recupererDonneesMur (id, token, identifiant, statut, res) {
		db.hgetall('murs:' + id, function (err, mur) {
			if (err) { res.send('erreur_mur'); return false }
			if (mur !== null && mur.hasOwnProperty('id') && mur.id === id && mur.hasOwnProperty('token') && mur.token === token) {
				const nombreColonnes = JSON.parse(mur.colonnes).length
				mur.colonnes = JSON.parse(mur.colonnes)
				if (mur.hasOwnProperty('notification')) {
					mur.notification = JSON.parse(mur.notification)
				}
				const slug = definirSlug(mur.titre)
				mur.slug = slug
				const vues = parseInt(mur.vues) + 1
				mur.admins = JSON.parse(mur.admins)
				mur.affichageColonnes = JSON.parse(mur.affichageColonnes)
				const blocsMur = new Promise(function (resolveMain) {
					const donneesBlocs = []
					db.zrange('blocs:' + id, 0, -1, function (err, blocs) {
						if (err) { resolveMain(donneesBlocs) }
						for (const bloc of blocs) {
							const donneesBloc = new Promise(function (resolve) {
								db.hgetall('contenu-blocs:' + id + ':' + bloc, function (err, donnees) {
									if (err) { resolve({}) }
									if (donnees && Object.keys(donnees).length > 0) {
										// Pour résoudre le problème des capsules qui sont référencées dans une colonne inexistante
										if (parseInt(donnees.colonne) >= nombreColonnes) {
											donnees.colonne = nombreColonnes - 1
										}
										donnees.medias = JSON.parse(donnees.medias)
										// Ne pas ajouter les capsules en attente de modération ou privées
										if (((mur.contributions === 'moderees' && donnees.visibilite === 'masquee') || donnees.visibilite === 'privee') && donnees.identifiant !== identifiant && mur.identifiant !== identifiant && !mur.admins.includes(identifiant)) {
											resolve({})
										}
										db.zcard('commentaires:' + bloc, function (err, commentaires) {
											if (err) {
												donnees.commentaires = []
												resolve(donnees)
											}
											donnees.commentaires = commentaires
											db.zrange('evaluations:' + bloc, 0, -1, function (err, evaluations) {
												if (err) {
													donnees.evaluations = []
													resolve(donnees)
												}
												const donneesEvaluations = []
												evaluations.forEach(function (evaluation) {
													donneesEvaluations.push(JSON.parse(evaluation))
												})
												donnees.evaluations = donneesEvaluations
												db.exists('utilisateurs:' + donnees.identifiant, function (err, resultat) {
													if (err) {
														donnees.nom = ''
														resolve(donnees)
													}
													if (resultat === 1) {
														db.hgetall('utilisateurs:' + donnees.identifiant, function (err, utilisateur) {
															if (err) {
																donnees.nom = ''
																resolve(donnees)
															}
															donnees.nom = utilisateur.nom
															resolve(donnees)
														})
													} else {
														db.exists('noms:' + donnees.identifiant, function (err, resultat) {
															if (err) {
																donnees.nom = ''
																resolve(donnees)
															}
															if (resultat === 1) {
																db.hget('noms:' + donnees.identifiant, 'nom', function (err, nom) {
																	if (err) {
																		donnees.nom = ''
																		resolve(donnees)
																	}
																	donnees.nom = nom
																	resolve(donnees)
																})
															} else {
																donnees.nom = ''
																resolve(donnees)
															}
														})
													}
												})
											})
										})
									} else {
										resolve({})
									}
								})
							})
							donneesBlocs.push(donneesBloc)
						}
						Promise.all(donneesBlocs).then(function (resultat) {
							resultat = resultat.filter(function (element) {
								return Object.keys(element).length > 0
							})
							resolveMain(resultat)
						})
					})
				})
				const activiteMur = new Promise(function (resolveMain) {
					const donneesEntrees = []
					db.zrange('activite:' + id, 0, -1, function (err, entrees) {
						if (err) { resolveMain(donneesEntrees) }
						for (let entree of entrees) {
							entree = JSON.parse(entree)
							const donneesEntree = new Promise(function (resolve) {
								db.exists('utilisateurs:' + entree.identifiant, function (err, resultat) {
									if (err) {
										entree.nom = ''
										resolve(entree)
									}
									if (resultat === 1) {
										db.hgetall('utilisateurs:' + entree.identifiant, function (err, utilisateur) {
											if (err) {
												entree.nom = ''
												resolve(entree)
											}
											entree.nom = utilisateur.nom
											resolve(entree)
										})
									} else {
										db.exists('noms:' + entree.identifiant, function (err, resultat) {
											if (err) {
												entree.nom = ''
												resolve(entree)
											}
											if (resultat === 1) {
												db.hget('noms:' + entree.identifiant, 'nom', function (err, nom) {
													if (err) { resolve({}) }
													entree.nom = nom
													resolve(entree)
												})
											} else {
												entree.nom = ''
												resolve(entree)
											}
										})
									}
								})
							})
							donneesEntrees.push(donneesEntree)
						}
						Promise.all(donneesEntrees).then(function (resultat) {
							resolveMain(resultat)
						})
					})
				})
				Promise.all([blocsMur, activiteMur]).then(function ([blocs, activite]) {
					if (mur.ordre === 'decroissant') {
						blocs.reverse()
					}
					// Ajouter nombre de vues
					db.hset('murs:' + id, 'vues', vues, function () {
						// Ajouter dans murs rejoints
						if (mur.identifiant !== identifiant && statut === 'utilisateur') {
							db.smembers('murs-rejoints:' + identifiant, function (err, mursRejoints) {
								if (err) { res.send('erreur_mur'); return false }
								let murDejaRejoint = false
								for (const murRejoint of mursRejoints) {
									if (murRejoint === id) {
										murDejaRejoint = true
									}
								}
								if (murDejaRejoint === false) {
									const multi = db.multi()
									multi.sadd('murs-rejoints:' + identifiant, id)
									multi.sadd('murs-utilisateurs:' + identifiant, id)
									multi.sadd('utilisateurs-murs:' + id, identifiant)
									multi.exec(function () {
										res.json({ mur: mur, blocs: blocs, activite: activite.reverse() })
									})
								} else {
									// Vérifier notification mise à jour mur
									if (mur.hasOwnProperty('notification') && mur.notification.includes(identifiant)) {
										mur.notification.splice(mur.notification.indexOf(identifiant), 1)
										db.hset('murs:' + id, 'notification', JSON.stringify(mur.notification), function () {
											res.json({ mur: mur, blocs: blocs, activite: activite.reverse() })
										})
									} else {
										res.json({ mur: mur, blocs: blocs, activite: activite.reverse() })
									}
								}
							})
						} else {
							// Vérifier notification mise à jour mur
							if (mur.hasOwnProperty('notification') && mur.notification.includes(identifiant)) {
								mur.notification.splice(mur.notification.indexOf(identifiant), 1)
								db.hset('murs:' + id, 'notification', JSON.stringify(mur.notification), function () {
									res.json({ mur: mur, blocs: blocs, activite: activite.reverse() })
								})
							} else {
								res.json({ mur: mur, blocs: blocs, activite: activite.reverse() })
							}
						}
					})
				})
			} else {
				res.send('erreur_mur')
			}
		})
	}

	function genererMotDePasse (longueur) {
		function rand (max) {
			return Math.floor(Math.random() * max)
		}
		function verifierMotDePasse (motdepasse, regex, caracteres) {
			if (!regex.test(motdepasse)) {
				const nouveauCaractere = caracteres.charAt(rand(caracteres.length))
				const position = rand(motdepasse.length + 1)
				motdepasse = motdepasse.slice(0, position) + nouveauCaractere + motdepasse.slice(position)
			}
			return motdepasse
		}
		let caracteres = '123456789abcdefghijklmnopqrstuvwxyz'
		const caracteresSpeciaux = '!#$@*'
		const specialRegex = /[!#\$@*]/
		const majuscules = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
		const majusculesRegex = /[A-Z]/

		caracteres = caracteres.split('')
		let motdepasse = ''
		let index

		while (motdepasse.length < longueur) {
			index = rand(caracteres.length)
			motdepasse += caracteres[index]
			caracteres.splice(index, 1)
		}
		motdepasse = verifierMotDePasse(motdepasse, specialRegex, caracteresSpeciaux)
		motdepasse = verifierMotDePasse(motdepasse, majusculesRegex, majuscules)
		return motdepasse  
	}

	const televerser = multer({
		storage: multer.diskStorage({
			destination: function (req, fichier, callback) {
				const mur = req.body.mur
				const chemin = path.join(__dirname, '..', '/static/' + definirDossierFichiers(mur) + '/' + mur + '/')
				callback(null, chemin)
			},
			filename: function (req, fichier, callback) {
				const info = path.parse(fichier.originalname)
				const extension = info.ext.toLowerCase()
				let nom = v.latinise(info.name.toLowerCase())
				nom = nom.replace(/\ /gi, '-')
				nom = nom.replace(/[^0-9a-z_\-]/gi, '')
				if (nom.length > 100) {
					nom = nom.substring(0, 100)
				}
				nom = nom + '_' + Math.random().toString(36).substring(2) + extension
				callback(null, nom)
			}
		})
	}).single('fichier')

	const televerserTemp = multer({
		storage: multer.diskStorage({
			destination: function (req, fichier, callback) {
				const chemin = path.join(__dirname, '..', '/static/temp/')
				callback(null, chemin)
			},
			filename: function (req, fichier, callback) {
				const info = path.parse(fichier.originalname)
				const extension = info.ext.toLowerCase()
				let nom = v.latinise(info.name.toLowerCase())
				nom = nom.replace(/\ /gi, '-')
				nom = nom.replace(/[^0-9a-z_\-]/gi, '')
				if (nom.length > 100) {
					nom = nom.substring(0, 100)
				}
				nom = nom + '_' + Math.random().toString(36).substring(2) + extension
				callback(null, nom)
			}
		})
	}).single('fichier')

	async function supprimerFichier (mur, fichier) {
		const chemin = path.join(__dirname, '..', '/static/' + definirDossierFichiers(mur) + '/' + mur + '/' + fichier)
		await fs.remove(chemin)
	}

	async function supprimerVignette (vignette) {
		const chemin = path.join(__dirname, '..', '/static' + vignette)
		await fs.remove(chemin)
	}

	function definirDossierFichiers (id) {
		if (process.env.VITE_NFS_WALL_NUMBER && process.env.VITE_NFS_WALL_NUMBER !== '' && process.env.VITE_NFS_FOLDER && process.env.VITE_NFS_FOLDER !== '' && parseInt(id) > parseInt(process.env.VITE_NFS_WALL_NUMBER)) {
			return process.env.VITE_NFS_FOLDER
		} else {
			return 'fichiers'
		}
	}

	function definirSlug (titre) {
		let slug = v.latinise(titre.toLowerCase())
		slug = slug.replace(/\ /gi, '-')
		slug = slug.replace(/[^0-9a-z_\-]/gi, '')
		return slug
	}

	function verifierURL (s, protocoles) {
		try {
			const url = new URL(s)
			return protocoles ? url.protocol ? protocoles.map(x => `${x.toLowerCase()}:`).includes(url.protocol) : false : true
		} catch (err) {
			return false
		}
	}

	function formaterDate (donnees, langue) {
		let dateFormattee = ''
		switch (langue) {
		case 'fr':
			if (donnees.hasOwnProperty('modifie')) {
				dateFormattee = 'Créée le ' + dayjs(new Date(donnees.date)).locale('fr').format('L') + ' à ' + dayjs(new Date(donnees.date)).locale('fr').format('LT') + ' par ' + donnees.nom + '. Modifiée le ' + dayjs(new Date(donnees.modifie)).locale('fr').format('L') + ' à ' + dayjs(new Date(donnees.modifie)).locale('fr').format('LT') + '.'
			} else {
				dateFormattee = 'Créée le ' + dayjs(new Date(donnees.date)).locale('fr').format('L') + ' à ' + dayjs(new Date(donnees.date)).locale('fr').format('LT') + ' par ' + donnees.nom + '.'
			}
			break
		case 'es':
			if (donnees.hasOwnProperty('modifie')) {
				dateFormattee = 'Creada el ' + dayjs(new Date(donnees.date)).locale('es').format('L') + ' a las ' + dayjs(new Date(donnees.date)).locale('es').format('LT') + ' por ' + donnees.nom + '. Modificada el ' + dayjs(new Date(donnees.modifie)).locale('es').format('L') + ' a las ' + dayjs(new Date(donnees.modifie)).locale('es').format('LT') + '.'
			} else {
				dateFormattee = 'Creada el ' + dayjs(new Date(donnees.date)).locale('es').format('L') + ' a las ' + dayjs(new Date(donnees.date)).locale('es').format('LT') + ' por ' + donnees.nom + '.'
			}
			break
		case 'it':
			if (donnees.hasOwnProperty('modifie')) {
				dateFormattee = 'Creazione attivata ' + dayjs(new Date(donnees.date)).locale('it').format('L') + ' alle ' + dayjs(new Date(donnees.date)).locale('it').format('LT') + ' di ' + donnees.nom + '. Modifica attivata ' + dayjs(new Date(donnees.modifie)).locale('it').format('L') + ' alle ' + dayjs(new Date(donnees.modifie)).locale('it').format('LT') + '.'
			} else {
				dateFormattee = 'Creazione attivata ' + dayjs(new Date(donnees.date)).locale('it').format('L') + ' alle ' + dayjs(new Date(donnees.date)).locale('it').format('LT') + ' di ' + donnees.nom + '.'
			}
			break
		case 'hr':
			if (donnees.hasOwnProperty('modifie')) {
				dateFormattee = 'Stvoreno na ' + dayjs(new Date(donnees.date)).locale('hr').format('L') + ' u ' + dayjs(new Date(donnees.date)).locale('hr').format('LT') + ' po ' + donnees.nom + '. Izmijenjeno na ' + dayjs(new Date(donnees.modifie)).locale('hr').format('L') + ' u ' + dayjs(new Date(donnees.modifie)).locale('hr').format('LT') + '.'
			} else {
				dateFormattee = 'Stvoreno na ' + dayjs(new Date(donnees.date)).locale('hr').format('L') + ' u ' + dayjs(new Date(donnees.date)).locale('hr').format('LT') + ' po ' + donnees.nom + '.'
			}
			break
		case 'en':
			if (donnees.hasOwnProperty('modifie')) {
				dateFormattee = 'Created on ' + dayjs(new Date(donnees.date)).locale('en').format('L') + ' at ' + dayjs(new Date(donnees.date)).locale('en').format('LT') + ' by ' + donnees.nom + '. Modified on ' + dayjs(new Date(donnees.modifie)).locale('en').format('L') + ' at ' + dayjs(new Date(donnees.modifie)).locale('en').format('LT') + '.'
			} else {
				dateFormattee = 'Created on ' + dayjs(new Date(donnees.date)).locale('en').format('L') + ' at ' + dayjs(new Date(donnees.date)).locale('en').format('LT') + ' by ' + donnees.nom + '.'
			}
			break
		}
		return dateFormattee
	}

	function genererHTML (mur, blocs) {
		return `
		<!DOCTYPE html>
		<html lang="fr">
			<head>
				<meta charset="utf-8">
				<meta name="viewport" content="width=device-width, height=device-height, viewport-fit=cover, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
				<meta name="description" content="Digiwall permet de créer des murs multimédias collaboratifs.">
				<meta name="robots" content="index, no-follow">
				<meta name="theme-color" content="#00ced1">
				<meta property="og:title" content="Digiwall by La Digitale">
				<meta property="og:description" content="Digiwall permet de créer des murs multimédias collaboratifs.">
				<meta property="og:type" content="website" />
				<meta property="og:locale" content="fr_FR" />
				<title>Digiwall by La Digitale</title>
				<link rel="icon" type="image/png" href="./static/img/favicon.png">
				<link rel="stylesheet" href="./static/css/destyle.css">
				<link rel="stylesheet" href="./static/css/main.css">
				<link rel="stylesheet" href="./static/css/mur.css">
				<link rel="stylesheet" href="./static/css/jspanel.css">
				<script src="./static/js/vue.js" type="text/javascript"></script>
				<script src="./static/js/vue-masonry-css.js" type="text/javascript"></script>
				<script src="./static/js/jspanel.js" type="text/javascript"></script>
			</head>
			<body>
				<noscript>
					<strong>Veuillez activer Javascript dans votre navigateur pour utiliser <i>Digiwall</i>.</strong>
				</noscript>
				<div id="app">
					<main id="page" :class="mur.affichage">
						<header v-if="!chargement">
							<span id="titre">{{ mur.titre }}</span>
						</header>

						<div id="mur" :class="{'fond-personnalise': mur.fond.substring(0, 1) !== '#' && !mur.fond.includes('/img/')}" :style="definirFond(mur.fond)" v-if="!chargement">
							<!-- Affichage mur -->
							<masonry id="blocs" class="mur" :cols="definirLargeurCapsules()" :gutter="0" v-if="mur.affichage === 'mur'">
								<div :id="item.bloc" class="bloc" v-for="(item, indexItem) in blocs" :style="{'border-color': item.couleur}" :data-bloc="item.bloc" :key="'bloc' + indexItem">
									<div class="contenu">
										<div class="titre" v-if="item.titre !== ''" :style="{'background': eclaircirCouleur(item.couleur)}">
											<span>{{ item.titre }}</span>
										</div>
										<div class="texte" v-if="item.texte !== ''" v-html="item.texte"></div>
										<div class="media" :class="{'iframe-video': item.type === 'embed' && item.vignetteActivee === 'non' && (item.source === 'digiview' || item.source === 'peertube' || item.source === 'youtube' || item.source === 'vimeo' || item.source === 'dailymotion' || item.source === 'soundcloud')}" v-if="item.media !== '' || item.medias.length > 0">
											<img v-if="item.type === 'image' || item.typeBloc === 'image-audio'" :src="'./fichiers/' + item.media" @click="afficherVisionneuse(item)">
											<img v-else-if="item.type === 'lien-image'" :src="item.media" @click="afficherVisionneuse(item)">
											<audio v-else-if="item.type === 'audio' && item.vignetteActivee === 'non'" controls preload="metadata" :src="'./fichiers/' + item.media"></audio>
											<video v-else-if="item.type === 'video' && item.vignetteActivee === 'non'" controls playsinline crossOrigin="anonymous" :src="'./fichiers/' + item.media"></video>
											<iframe v-else-if="item.type === 'embed' && item.vignetteActivee === 'non' && (item.source === 'digiview' || item.source === 'peertube' || item.source === 'youtube' || item.source === 'vimeo' || item.source === 'dailymotion' || item.source === 'soundcloud')" :src="item.iframe" allowfullscreen></iframe>
											<span v-else-if="item.type === 'audio' || item.type === 'video' || item.type === 'embed' || item.typeBloc === 'galerie'" @click="afficherVisionneuse(item)"><img :class="{'vignette': definirVignette(item).substring(0, 9) !== './static/'}" :src="definirVignette(item)"></span>
											<span v-else-if="item.type === 'document' || item.type === 'pdf' || item.type === 'office'" @click="afficherMedia(item)"><img :class="{'vignette': definirVignette(item).substring(0, 9) !== './static/'}" :src="definirVignette(item)"></span>
											<span v-else-if="item.type === 'lien'"><a :href="item.media" target="_blank"><img :class="{'vignette': definirVignette(item).substring(0, 9) !== './static/'}" :src="definirVignette(item)"></a></span>
											<span v-else><a :href="'./fichiers/' + item.media" download><img :class="{'vignette': definirVignette(item).substring(0, 9) !== './static/'}" :src="definirVignette(item)"></a></span>
											<audio v-if="item.typeBloc === 'image-audio'" controls preload="metadata" :src="'./fichiers/' + item.mediaExtra"></audio>
										</div>
										<div class="evaluation" v-if="mur.evaluations === 'activees'">
											<span class="etoiles">
												<i class="material-icons" v-for="etoile in definirEvaluationCapsule(item.listeEvaluations)" :key="'etoilepleine_' + etoile">star</i>
												<i class="material-icons" v-for="etoile in (5 - definirEvaluationCapsule(item.listeEvaluations))" :key="'etoilevide_' + etoile">star_outline</i>
												<span>({{ item.listeEvaluations.length }})</span>
											</span>
										</div>
										<div class="action" :style="{'color': item.couleur}">
											<span role="button" tabindex="0" class="bouton" @click="ouvrirModaleCommentaires(item.bloc, item.titre)" v-if="mur.commentaires === 'actives'"><i class="material-icons">comment</i><span class="badge">{{ item.commentaires }}</span></span>
											<span role="button" tabindex="0" class="bouton info" :data-description="item.info"><i class="material-icons">info</i></span>
											<span class="media-type" v-if="item.media !== '' || item.medias.length > 0"><i class="material-icons">{{ definirIconeMedia(item) }}</i></span>
										</div>
									</div>
								</div>
							</masonry>
							<!-- Affichage flux vertical -->
							<div id="blocs" class="flux-vertical" :class="{'large': mur.hasOwnProperty('largeur') && mur.largeur === 'large'}" v-else-if="mur.affichage === 'flux-vertical'">
								<div :id="item.bloc" class="bloc" v-for="(item, indexItem) in blocs" :style="{'border-color': item.couleur}" :data-bloc="item.bloc" :key="'bloc' + indexItem">
									<div class="contenu">
										<div class="titre" v-if="item.titre !== ''" :style="{'background': eclaircirCouleur(item.couleur)}">
											<span>{{ item.titre }}</span>
										</div>
										<div class="texte" v-if="item.texte !== ''" v-html="item.texte"></div>
										<div class="media" :class="{'iframe-video': item.type === 'embed' && item.vignetteActivee === 'non' && (item.source === 'digiview' || item.source === 'peertube' || item.source === 'youtube' || item.source === 'vimeo' || item.source === 'dailymotion' || item.source === 'soundcloud')}" v-if="item.media !== '' || item.medias.length > 0">
											<img v-if="item.type === 'image' || item.typeBloc === 'image-audio'" :src="'./fichiers/' + item.media" @click="afficherVisionneuse(item)">
											<img v-else-if="item.type === 'lien-image'" :src="item.media" @click="afficherVisionneuse(item)">
											<audio v-else-if="item.type === 'audio' && item.vignetteActivee === 'non'" controls preload="metadata" :src="'./fichiers/' + item.media"></audio>
											<video v-else-if="item.type === 'video' && item.vignetteActivee === 'non'" controls playsinline crossOrigin="anonymous" :src="'./fichiers/' + item.media"></video>
											<iframe v-else-if="item.type === 'embed' && item.vignetteActivee === 'non' && (item.source === 'digiview' || item.source === 'peertube' || item.source === 'youtube' || item.source === 'vimeo' || item.source === 'dailymotion' || item.source === 'soundcloud')" :src="item.iframe" allowfullscreen></iframe>
											<span v-else-if="item.type === 'audio' || item.type === 'video' || item.type === 'embed' || item.typeBloc === 'galerie'" @click="afficherVisionneuse(item)"><img :class="{'vignette': definirVignette(item).substring(0, 9) !== './static/'}" :src="definirVignette(item)"></span>
											<span v-else-if="item.type === 'document' || item.type === 'pdf' || item.type === 'office'" @click="afficherMedia(item)"><img :class="{'vignette': definirVignette(item).substring(0, 9) !== './static/'}" :src="definirVignette(item)"></span>
											<span v-else-if="item.type === 'lien'"><a :href="item.media" target="_blank"><img :class="{'vignette': definirVignette(item).substring(0, 9) !== './static/'}" :src="definirVignette(item)"></a></span>
											<span v-else><a :href="'./fichiers/' + item.media" download><img :class="{'vignette': definirVignette(item).substring(0, 9) !== './static/'}" :src="definirVignette(item)"></a></span>
											<audio v-if="item.typeBloc === 'image-audio'" controls preload="metadata" :src="'./fichiers/' + item.mediaExtra"></audio>
										</div>
										<div class="evaluation" v-if="mur.evaluations === 'activees'">
											<span class="etoiles">
												<i class="material-icons" v-for="etoile in definirEvaluationCapsule(item.listeEvaluations)" :key="'etoilepleine_' + etoile">star</i>
												<i class="material-icons" v-for="etoile in (5 - definirEvaluationCapsule(item.listeEvaluations))" :key="'etoilevide_' + etoile">star_outline</i>
												<span>({{ item.listeEvaluations.length }})</span>
											</span>
										</div>
										<div class="action" :style="{'color': item.couleur}">
											<span role="button" tabindex="0" class="bouton" @click="ouvrirModaleCommentaires(item.bloc, item.titre)" v-if="mur.commentaires === 'actives'"><i class="material-icons">comment</i><span class="badge">{{ item.commentaires }}</span></span>
											<span role="button" tabindex="0" class="bouton info" :data-description="item.info"><i class="material-icons">info</i></span>
											<span class="media-type" v-if="item.media !== '' || item.medias.length > 0"><i class="material-icons">{{ definirIconeMedia(item) }}</i></span>
										</div>
									</div>
								</div>
							</div>
							<!-- Affichage colonne -->
							<div id="blocs" class="colonnes" v-else-if="mur.affichage === 'colonnes'">
								<section :id="'colonne' + indexCol" class="colonne" :class="{'large': mur.hasOwnProperty('largeur') && mur.largeur === 'large'}" v-for="(col, indexCol) in mur.colonnes" :key="'colonne' + indexCol">
									<div class="bloc haut">
										<div class="titre-colonne">
											<span>{{ col }}</span>
										</div>
									</div>
									<div class="conteneur-colonne ascenseur" v-if="colonnes[indexCol].length > 0">
										<div :id="item.bloc" class="bloc" v-for="(item, indexItem) in colonnes[indexCol]" :style="{'border-color': item.couleur}" :data-bloc="item.bloc" :key="'bloc' + indexItem">
											<div class="contenu">
												<div class="titre" v-if="item.titre !== ''" :style="{'background': eclaircirCouleur(item.couleur)}">
													<span>{{ item.titre }}</span>
												</div>
												<div class="texte" v-if="item.texte !== ''" v-html="item.texte"></div>
												<div class="media" :class="{'iframe-video': item.type === 'embed' && item.vignetteActivee === 'non' && (item.source === 'digiview' || item.source === 'peertube' || item.source === 'youtube' || item.source === 'vimeo' || item.source === 'dailymotion' || item.source === 'soundcloud')}" v-if="item.media !== '' || item.medias.length > 0">
													<img v-if="item.type === 'image' || item.typeBloc === 'image-audio'" :src="'./fichiers/' + item.media" @click="afficherVisionneuse(item)">
													<img v-else-if="item.type === 'lien-image'" :src="item.media" @click="afficherVisionneuse(item)">
													<audio v-else-if="item.type === 'audio' && item.vignetteActivee === 'non'" controls preload="metadata" :src="'./fichiers/' + item.media"></audio>
													<video v-else-if="item.type === 'video' && item.vignetteActivee === 'non'" controls playsinline crossOrigin="anonymous" :src="'./fichiers/' + item.media"></video>
													<iframe v-else-if="item.type === 'embed' && item.vignetteActivee === 'non' && (item.source === 'digiview' || item.source === 'peertube' || item.source === 'youtube' || item.source === 'vimeo' || item.source === 'dailymotion' || item.source === 'soundcloud')" :src="item.iframe" allowfullscreen></iframe>
													<span v-else-if="item.type === 'audio' || item.type === 'video' || item.type === 'embed' || item.typeBloc === 'galerie'" @click="afficherVisionneuse(item)"><img :class="{'vignette': definirVignette(item).substring(0, 9) !== './static/'}" :src="definirVignette(item)"></span>
													<span v-else-if="item.type === 'document' || item.type === 'pdf' || item.type === 'office'" @click="afficherMedia(item)"><img :class="{'vignette': definirVignette(item).substring(0, 9) !== './static/'}" :src="definirVignette(item)"></span>
													<span v-else-if="item.type === 'lien'"><a :href="item.media" target="_blank"><img :class="{'vignette': definirVignette(item).substring(0, 9) !== './static/'}" :src="definirVignette(item)"></a></span>
													<span v-else><a :href="'./fichiers/' + item.media" download><img :class="{'vignette': definirVignette(item).substring(0, 9) !== './static/'}" :src="definirVignette(item)"></a></span>
													<audio v-if="item.typeBloc === 'image-audio'" controls preload="metadata" :src="'./fichiers/' + item.mediaExtra"></audio>
												</div>
												<div class="evaluation" v-if="mur.evaluations === 'activees'">
													<span class="etoiles">
														<i class="material-icons" v-for="etoile in definirEvaluationCapsule(item.listeEvaluations)" :key="'etoilepleine_' + etoile">star</i>
														<i class="material-icons" v-for="etoile in (5 - definirEvaluationCapsule(item.listeEvaluations))" :key="'etoilevide_' + etoile">star_outline</i>
														<span>({{ item.listeEvaluations.length }})</span>
													</span>
												</div>
												<div class="action" :style="{'color': item.couleur}">
													<span role="button" tabindex="0" class="bouton" @click="ouvrirModaleCommentaires(item.bloc)" v-if="mur.commentaires === 'actives'"><i class="material-icons">comment</i><span class="badge">{{ item.commentaires }}</span></span>
													<span role="button" tabindex="0" class="bouton info" :data-description="item.info"><i class="material-icons">info</i></span>
													<span class="media-type" v-if="item.media !== '' || item.medias.length > 0"><i class="material-icons">{{ definirIconeMedia(item) }}</i></span>
												</div>
											</div>
										</div>
									</div>
								</section>
							</div>
						</div>

						<div class="conteneur-modale" v-if="modaleCommentaires">
							<div id="discussion" class="modale">
								<div class="en-tete">
									<span class="titre">{{ titre }}</span>
									<span role="button" tabindex="0" class="fermer" @click="fermerModaleCommentaires"><i class="material-icons">close</i></span>
								</div>
								<ul class="commentaires ascenseur">
									<li v-for="(entreeCommentaire, indexEntreeCommentaire) in commentaires" :key="indexEntreeCommentaire">
										<span class="meta">// {{ noms[entreeCommentaire.identifiant] }}</span>
										<div class="texte" v-html="entreeCommentaire.texte"></div>
									</li>
								</ul>
							</div>
						</div>
						
						<div id="conteneur-chargement" v-if="chargement">
							<div id="chargement">
								<div class="spinner">
									<div></div>
									<div></div>
									<div></div>
									<div></div>
									<div></div>
									<div></div>
									<div></div>
									<div></div>
									<div></div>
									<div></div>
									<div></div>
									<div></div>
								</div>
							</div>
						</div>

						<div id="masque"></div>
					</main>
				</div>
				
				<script type="text/javascript">
					var vm = new Vue({
						el: '#app',
						data: {
							chargement: true,
							modaleCommentaires: false,
							mur: ` + JSON.stringify(mur) + `,
							blocs: ` + JSON.stringify(blocs) + `,
							colonnes: [],
							commentaires: [],
							panneaux: [],
							noms: {},
							titre: '',
							defilement: false,
							depart: 0,
							distance: 0
						},
						methods: {
							ouvrirModaleCommentaires (bloc) {
								let commentaires = []
								let titre = ''
								this.blocs.forEach(function (item) {
									if (item.bloc === bloc) {
										commentaires = item.listeCommentaires
										titre = item.titre
									}
								})
								if (commentaires.length > 0) {
									this.commentaires = commentaires
									this.titre = titre
									this.modaleCommentaires = true
								}
							},
							fermerModaleCommentaires () {
								this.modaleCommentaires = false
								this.commentaires = []
								this.titre = ''
							},
							definirFond (fond) {
								if (fond.substring(0, 1) === '#') {
									return { backgroundColor: fond }
								} else if (fond.includes('/img/')) {
									return { backgroundImage: 'url(./static' + fond + ')' }
								} else {
									return { backgroundImage: 'url(./fichiers/' + fond.split('/').pop() + ')' }
								}
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
							definirColonnes (blocs) {
								const colonnes = []
								if (this.mur.colonnes && JSON.parse(this.mur.colonnes).length > 0) {
									this.mur.colonnes = JSON.parse(this.mur.colonnes)
									this.mur.colonnes.forEach(function () {
										colonnes.push([])
									})
									blocs.forEach(function (bloc, index) {
										if (bloc.colonne !== undefined) {
											colonnes[parseInt(bloc.colonne)].push(bloc)
										} else {
											blocs[index].colonne = 0
											colonnes[bloc.colonne].push(bloc)
										}
									})
								} else {
									this.mur.colonnes.push('Colonne sans titre')
									colonnes.push([])
									blocs.forEach(function (bloc, index) {
										blocs[index].colonne = 0
										colonnes[0].push(bloc)
									})
								}
								this.blocs = blocs
								this.colonnes = colonnes
							},
							afficherMedia (item) {
								let lien
								if (this.verifierURL(item.media) === true) {
									lien = item.media
								} else {
									lien = './fichiers/' + item.media
								}
								window.open(lien, '_blank')
							},
							definirVignette (item) {
								let vignette
								if (item.vignette && item.vignette !== '' && this.verifierURL(item.vignette) === false && item.vignette.includes('/img/')) {
									vignette = './static/img/' + item.vignette.split('/').pop()
								} else if (item.vignette && item.vignette !== '' && this.verifierURL(item.vignette) === false && !item.vignette.includes('/img/')) {
									vignette = './fichiers/' + item.vignette.split('/').pop()
								} else if (item.vignette && item.vignette !== '' && this.verifierURL(item.vignette) === true) {
									vignette = item.vignette
								}
								return vignette
							},
							afficherVisionneuse (item) {
								if (this.panneaux.map(function (e) { return e.id }).includes('panneau_' + item.bloc) === false) {
									const imageId = 'image-' + (new Date()).getTime()
									let html
									switch (item.type) {
									case 'image':
										html = '<span id="' + imageId + '" class="image"><img src="./fichiers/' + item.media + '"></span>'
										break
									case 'lien-image':
										html = '<span id="' + imageId + '" class="image"><img src="' + item.media + '"></span>'
										break
									case 'audio':
										html = '<audio controls preload="metadata" src="./fichiers/' + item.media + '"></audio>'
										break
									case 'video':
										html = '<video controls playsinline crossOrigin="anonymous" src="./fichiers/' + item.media + '"></video>'
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
												html += '<div class="diapo"><div class="numero">' + (i + 1) + '/' + item.medias.length + '</div><img src="./fichiers/' + item.medias[i].fichier + '"><span class="legende">' + item.medias[i].legende + '</span></div>'
											} else {
												html += '<div class="diapo"><div class="numero">' + (i + 1) + '/' + item.medias.length + '</div><img src="./fichiers/' + item.medias[i].fichier + '"></div>'
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
												} else if (item.type === 'audio') {
													panel.resize({
														width: largeurPanneau,
														height: '150px'
													}).reposition()
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
							verifierURL (lien) {
								let url
								try {
									url = new URL(lien)
								} catch (_) {
									return false
								}
								return url.protocol === 'http:' || url.protocol === 'https:'
							},
							genererPseudo () {
								const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
								const nom = caracteres.charAt(Math.floor(Math.random() * caracteres.length)) + caracteres.charAt(Math.floor(Math.random() * caracteres.length)) + Math.floor(Math.random() * (9999 - 1000) + 1000)
								return nom
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
							}
						},
						created () {
							if (this.mur.ordre === 'decroissant') {
								this.blocs.reverse()
							}
							if (this.mur.affichage === 'colonnes') {
								this.definirColonnes(this.blocs)
							}
						},
						mounted () {
							const noms = {}
							this.blocs.forEach(function (bloc) {
								if (noms.hasOwnProperty(bloc.identifiant) === false) {
									noms[bloc.identifiant] = bloc.nom
								}
								bloc.listeCommentaires.forEach(function (commentaire) {
									if (noms.hasOwnProperty(commentaire.identifiant) === false) {
										noms[commentaire.identifiant] = this.genererPseudo()
									}
								}.bind(this))
							}.bind(this))
							this.noms = noms
							document.title = this.mur.titre + ' - Digiwall by La Digitale'
							this.chargement = false
							if (this.mur.affichage === 'colonnes') {
								this.$nextTick(function () {
									this.activerDefilementHorizontal()
								}.bind(this))
							}
						}
					})
				</script>
			</body>
		</html>`
	}
}
