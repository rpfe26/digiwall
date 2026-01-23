import 'dotenv/config'
import path from 'path'
import fs from 'fs-extra'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { createAdapter } from '@socket.io/cluster-adapter'
import eiows from 'eiows'
import compression from 'compression'
import axios from 'axios'
import cors from 'cors'
import { createClient } from 'redis'
import bodyParser from 'body-parser'
import helmet from 'helmet'
import v from 'voca'
import multer from 'multer'
import Busboy from 'busboy'
import sharp from 'sharp'
import gm from 'gm'
import archiver from 'archiver'
import extract from 'extract-zip'
import dayjs from 'dayjs'
import 'dayjs/locale/es.js'
import 'dayjs/locale/fr.js'
import 'dayjs/locale/it.js'
import localizedFormat from 'dayjs/plugin/localizedFormat.js'
import bcrypt from 'bcrypt'
import cron from 'node-cron'
import nodemailer from 'nodemailer'
import { URL, fileURLToPath } from 'url'
import * as cheerio from 'cheerio'
import libre from 'libreoffice-convert'
import util from 'util'
libre.convertAsync = util.promisify(libre.convert)
import { RedisStore } from 'connect-redis'
import session from 'express-session'
import { EventEmitter } from 'events'
import { randomBytes } from 'crypto'
import Rabbit from 'crypto-js/rabbit.js'
import Utf8 from 'crypto-js/enc-utf8.js'
import checkDiskSpace from 'check-disk-space'
import { S3Client, CopyObjectCommand, PutObjectCommand, ListObjectsV2Command, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { renderPage, createDevMiddleware } from 'vike/server'

const production = process.env.NODE_ENV === 'production'
let cluster = false
if (production) {
	cluster = parseInt(process.env.NODE_CLUSTER) === 1
}
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = `${__dirname}/..`

demarrerServeur()

async function demarrerServeur () {
	const app = express()
	app.use(compression())
	const httpServer = createServer(app)

	let hote = 'http://localhost:3000'
	if (production) {
		hote = process.env.DOMAIN
	} else if (process.env.PORT) {
		hote = 'http://localhost:' + process.env.PORT
	}
	const hoteTeleversement = process.env.UPLOAD_HOST || hote
	let stockage = 'fs'
	const lienPublicS3 = process.env.VITE_S3_PUBLIC_LINK
	let s3Client = ''
	let bucket = ''
	if (process.env.VITE_STORAGE && process.env.VITE_STORAGE === 's3' && lienPublicS3 !== null && lienPublicS3 !== '') {
		stockage = 's3'
		bucket = process.env.S3_BUCKET
	}
	if (stockage === 's3') {
		const s3ServerType = process.env.S3_SERVER_TYPE || 'aws'
		const maxSockets = process.env.S3_MAX_SOCKETS || 500
		s3Client = new S3Client({
			endpoint: process.env.S3_ENDPOINT,
			region: process.env.S3_REGION,
			credentials: {
				accessKeyId: process.env.S3_ACCESS_KEY,
				secretAccessKey: process.env.S3_SECRET_KEY
			},
			forcePathStyle: s3ServerType === 'minio' ? true : false,
			requestHandler: {
				requestTimeout: 30_000,
				httpsAgent: { maxSockets: maxSockets }
			}
		})
	}
	let db
	const db_port = process.env.DB_PORT || 6379
	if (production) {
		db = await createClient({
			url: 'redis://default:' + process.env.DB_PWD  + '@' + process.env.DB_HOST + ':' + db_port
		}).on('error', function (err) {
			console.log('redis: ', err)
		}).connect()
	} else {
		db = await createClient({
			url: 'redis://localhost:' + db_port
		}).on('error', function (err) {
			console.log('redis: ' + err)
		}).connect()
	}
	let storeOptions, cookie, domainesAutorises
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
	const redisStore = new RedisStore(storeOptions)
	const sessionOptions = {
		secret: process.env.SESSION_KEY,
		store: redisStore,
		name: 'digiwall',
		resave: false,
		rolling: true,
		saveUninitialized: false,
		cookie: cookie
	}
	const dureeSession = parseInt(process.env.SESSION_DURATION) || 864000000 //3600 * 24 * 10 * 1000
	const sessionMiddleware = session(sessionOptions)

	if (production && process.env.AUTHORIZED_DOMAINS && process.env.AUTHORIZED_DOMAINS !== null && process.env.AUTHORIZED_DOMAINS !== '') {
		domainesAutorises = process.env.AUTHORIZED_DOMAINS.split(',')
	} else {
		domainesAutorises = '*'
	}

	let earlyHints103 = false
	if (process.env.EARLY_HINTS && parseInt(process.env.EARLY_HINTS) === 1) {
		earlyHints103 = true
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

	const dateCron = process.env.CRON_TASK_DATE || '59 23 * * Saturday' // tous les samedis à 23h59
	cron.schedule(dateCron, async function () {
		await fs.emptyDir(path.join(__dirname, '..', '/static/temp'))
	})

	const minimumEspaceDisque = parseInt(process.env.ALERT_AVAILABLE_SPACE) || 10

	// Charger plugin dayjs
	dayjs.extend(localizedFormat)

	const etherpad = process.env.VITE_ETHERPAD
	const etherpadApi = process.env.VITE_ETHERPAD_API_KEY

	const creationCompte = parseInt(process.env.VITE_CREATE_ACCOUNT) || 1
	const creationMurSansCompte = parseInt(process.env.VITE_WALL_WITHOUT_ACCOUNT) || 1

	const cleCrypto = process.env.ENCRYPTION_KEY || ''

	const validationInscription = parseInt(process.env.ACCOUNT_VALIDATION) || 0

	// Augmenter nombre de tâches asynchrones par défaut
	EventEmitter.defaultMaxListeners = 20

	app.set('trust proxy', true)
	app.use(
		helmet.contentSecurityPolicy({
			directives: {
				"default-src": ["'self'", "https:", "ws:"],
				"script-src": ["'self'", process.env.VITE_MATOMO, "'unsafe-inline'", "'unsafe-eval'"],
				"media-src": ["'self'", "https:", "data:", "blob:"],
				"worker-src": ["'self'", "https:", "data:", "blob:"],
				"img-src": ["'self'", "https:", "data:"],
				"frame-ancestors": ["*"],
				"frame-src": ["*", "blob:"]
			}
		})
	)
	app.use(bodyParser.json({ limit: '500mb' }))
	app.use(sessionMiddleware)
	app.use(cors({ 'origin': domainesAutorises }))
	if (parseInt(process.env.REVERSE_PROXY) !== 1 || !production) {
		app.use('/fichiers', express.static('static/fichiers'))
		app.use('/pdfjs', express.static('static/pdfjs'))
		app.use('/temp', express.static('static/temp'))
	}

	if (!production) {
		const { devMiddleware } = (
      		await createDevMiddleware({ root })
    	)
    	app.use(devMiddleware)
  	} else if (production && parseInt(process.env.REVERSE_PROXY) !== 1) {
		const sirv = (await import('sirv')).default
		app.use(sirv(`${root}/dist/client`))
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
				langues: ['fr', 'es', 'it', 'de', 'en'],
				langue: langue
			}
			const pageContext = await renderPage(pageContextInit)
			if (pageContext.errorWhileRendering) {
				if (!pageContext.httpResponse) {
					throw pageContext.errorWhileRendering
				}
			}
			const { httpResponse } = pageContext
			if (!httpResponse) {
				return next()
			}
			const { body, statusCode, headers, earlyHints } = httpResponse
			if (earlyHints103 === true && res.writeEarlyHints) {
				res.writeEarlyHints({ link: earlyHints.map((e) => e.earlyHintLink) })
			}
			if (headers) {
				headers.forEach(([name, value]) => res.setHeader(name, value))
			}
			res.status(statusCode).send(body)
		}
  	})
	
	app.get('/u/:utilisateur', async function (req, res, next) {
		const identifiant = req.params.utilisateur
		if (maintenance === true) {
			res.redirect('/maintenance')
		} else if (identifiant === req.session.identifiant && req.session.statut === 'utilisateur' && req.session.hasOwnProperty('motdepasse') && req.session.motdepasse !== '') {
			let donneesUtilisateur = await db.HGETALL('utilisateurs:' + identifiant)
			donneesUtilisateur = Object.assign({}, donneesUtilisateur)
			if (donneesUtilisateur === null || !donneesUtilisateur.hasOwnProperty('motdepasse')) { res.redirect('/'); return false }
			if (await bcrypt.compare(req.session.motdepasse, donneesUtilisateur.motdepasse)) {
				recupererDonneesUtilisateur(identifiant).then(async function (murs) {
					let contenusSupprimes = []
					let favorisSupprimes = []
					let mursCrees = murs[0].filter(function (element) {
						if (element.hasOwnProperty('id')) {
							element.id = parseInt(element.id)
						}
						return element !== '' && Object.keys(element).length > 0
					})
					let mursCorbeille = murs[1].filter(function (element) {
						if (element.hasOwnProperty('id')) {
							element.id = parseInt(element.id)
							contenusSupprimes.push(parseInt(element.id))
						}
						return element !== '' && Object.keys(element).length > 0
					})
					let mursRejoints = murs[2].filter(function (element) {
						if (element.hasOwnProperty('id')) {
							element.id = parseInt(element.id)
						}
						return element !== '' && Object.keys(element).length > 0
					})
					let mursAdmins = murs[3].filter(function (element) {
						if (element.hasOwnProperty('id')) {
							element.id = parseInt(element.id)
						}
						return element !== '' && Object.keys(element).length > 0
					})
					let mursFavoris = murs[4].filter(function (element) {
						if (element.hasOwnProperty('id')) {
							element.id = parseInt(element.id)
							if (contenusSupprimes.includes(parseInt(element.id))) {
								favorisSupprimes.push(parseInt(element.id))
							}
						}
						return element !== '' && Object.keys(element).length > 0 && !contenusSupprimes.includes(element.id)
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
					mursCorbeille = mursCorbeille.filter((valeur, index, self) =>
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
					// Dossiers
					let contenusSupprimesDansDossiers = []
					let dossiers = []
					if (donneesUtilisateur.hasOwnProperty('dossiers')) {
						try {
							dossiers = JSON.parse(donneesUtilisateur.dossiers)
						} catch (err) {
							dossiers = []
						}
					}
					const listeMursDossiers = []
					dossiers.forEach(function (dossier, indexDossier) {
						dossier.murs.forEach(function (mur, indexMur) {
							dossiers[indexDossier].murs[indexMur] = parseInt(mur)
							if (contenusSupprimes.includes(parseInt(mur))) {
								contenusSupprimesDansDossiers.push({ mur: parseInt(mur), dossier: dossier.id })
							}
							if (!listeMursDossiers.includes(parseInt(mur))) {
								listeMursDossiers.push(parseInt(mur))
							}
						})
					})
					const donneesMursDossiers = []
					for (const mur of listeMursDossiers) {
						const donneeMursDossiers = new Promise(async function (resolve) {
							const resultat = await db.EXISTS('murs:' + mur)
							if (resultat === null || resultat === 1) {
								resolve()
							} else {
								resolve(parseInt(mur))
							}
						})
						donneesMursDossiers.push(donneeMursDossiers)
					}
					Promise.all(donneesMursDossiers).then(async function (mursSupprimes) {
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
						// Préparer contenus corbeille avec favoris et dossiers
						mursCorbeille.forEach(function (mur, indexMur) {
							if (favorisSupprimes.includes(mur.id)) {
								mursCorbeille[indexMur].favori = true
							} else {
								mursCorbeille[indexMur].favori = false
							}
							if (contenusSupprimesDansDossiers.map(function (e) { return e.mur }).includes(mur.id)) {
								const index = contenusSupprimesDansDossiers.map(function (e) { return e.mur }).indexOf(mur.id)
								mursCorbeille[indexMur].dossier = contenusSupprimesDansDossiers[index].dossier
							} else {
								mursCorbeille[indexMur].dossier = ''
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
						await db.HSET('utilisateurs:' + identifiant, 'dossiers', JSON.stringify(dossiers))
						// Supprimer contenus corbeille dans dossiers
						dossiers.forEach(function (dossier, indexDossier) {
							dossier.murs.forEach(function () {
								dossiers[indexDossier].murs = dossiers[indexDossier].murs.filter(function (element) {
									return !contenusSupprimes.includes(element)
								})
							})
						})
						const pageContextInit = {
							urlOriginal: req.originalUrl,
							params: req.query,
							hote: hote,
							langues: ['fr', 'es', 'it', 'de', 'en'],
							identifiant: req.session.identifiant,
							nom: req.session.nom,
							email: req.session.email,
							langue: req.session.langue,
							statut: req.session.statut,
							affichage: donneesUtilisateur.affichage,
							classement: donneesUtilisateur.classement,
							mursCrees: mursCrees,
							mursCorbeille: mursCorbeille,
							mursRejoints: mursRejoints,
							mursAdmins: mursAdmins,
							mursFavoris: mursFavoris,
							dossiers: dossiers
						}
						const pageContext = await renderPage(pageContextInit)
						if (pageContext.errorWhileRendering) {
							if (!pageContext.httpResponse) {
								throw pageContext.errorWhileRendering
							}
						}
						const { httpResponse } = pageContext
						if (!httpResponse) {
							return next()
						}
						const { body, statusCode, headers, earlyHints } = httpResponse
						if (earlyHints103 === true && res.writeEarlyHints) {
							res.writeEarlyHints({ link: earlyHints.map((e) => e.earlyHintLink) })
						}
						if (headers) {
							headers.forEach(([name, value]) => res.setHeader(name, value))
						}
						res.status(statusCode).send(body)
					})
				})
			} else {
				supprimerSession(req)
				res.redirect('/')
			}
		} else {
			supprimerSession(req)
			res.redirect('/')
		}
  	})
	
	app.get('/w/:id/:token/:slug', async function (req, res, next) {
		if (maintenance === true) {
			res.redirect('/maintenance')
			return false
		}
		if (req.session.identifiant === '' || req.session.identifiant === undefined) {
			const identifiant = 'u' + Math.random().toString(16).slice(3)
			req.session.identifiant = identifiant
			req.session.motdepasse = ''
			req.session.nom = identifiant.slice(0, 8).toUpperCase()
			req.session.email = ''
			req.session.langue = 'fr'
			req.session.statut = 'invite'
			req.session.acces = []
			req.session.murs = []
			req.session.blocsAutorises = []
			req.session.cookie.expires = new Date(Date.now() + dureeSession)
		}
		if (!req.session.hasOwnProperty('acces')) {
			req.session.acces = []
		}
		if (!req.session.hasOwnProperty('murs')) {
			req.session.murs = []
		}
		if (!req.session.hasOwnProperty('blocsAutorises')) {
			req.session.blocsAutorises = []
		}
		if (req.query.id && req.query.id !== '' && req.query.mdp && req.query.mdp !== '') {
			try {
				const id = decodeURIComponent(req.query.id)
				const mdpB = Rabbit.decrypt(decodeURIComponent(req.query.mdp), cleCrypto)
				const mdp = mdpB.toString(Utf8)
				const mur = req.params.id
				const { acces, utilisateur } = await verifierAcces(mur, id, mdp)
				if (acces === 'mur_debloque') {
					req.session.identifiant = utilisateur.id
					req.session.motdepasse = ''
					req.session.nom = utilisateur.nom
					req.session.statut = 'auteur'
					req.session.langue = utilisateur.langue
					if (!req.session.murs.includes(parseInt(mur))) {
						req.session.murs.push(parseInt(mur))
					}
					req.session.cookie.expires = new Date(Date.now() + dureeSession)
				}
			} catch (e) {}
		}
		const userAgent = req.headers['user-agent']
		const pageContextInit = {
			urlOriginal: req.originalUrl,
			params: req.query,
			hote: hote,
			hoteTeleversement: hoteTeleversement,
			userAgent: userAgent,
			langues: ['fr', 'es', 'it', 'de', 'en'],
			identifiant: req.session.identifiant,
			nom: req.session.nom,
			email: req.session.email,
			langue: req.session.langue,
			statut: req.session.statut,
			murs: req.session.murs,
			blocsAutorises: req.session.blocsAutorises
		}
		const pageContext = await renderPage(pageContextInit)
		if (pageContext.errorWhileRendering) {
			if (!pageContext.httpResponse) {
				throw pageContext.errorWhileRendering
			}
		}
		const { httpResponse } = pageContext
		if (!httpResponse) {
			return next()
		}
		const { body, statusCode, headers, earlyHints } = httpResponse
		if (earlyHints103 === true && res.writeEarlyHints) {
			res.writeEarlyHints({ link: earlyHints.map((e) => e.earlyHintLink) })
		}
		if (headers) {
			headers.forEach(([name, value]) => res.setHeader(name, value))
		}
		res.status(statusCode).send(body)
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
		if (pageContext.errorWhileRendering) {
			if (!pageContext.httpResponse) {
				throw pageContext.errorWhileRendering
			}
		}
		const { httpResponse } = pageContext
		if (!httpResponse) {
			return next()
		}
		const { body, statusCode, headers, earlyHints } = httpResponse
		if (earlyHints103 === true && res.writeEarlyHints) {
			res.writeEarlyHints({ link: earlyHints.map((e) => e.earlyHintLink) })
		}
		if (headers) {
			headers.forEach(([name, value]) => res.setHeader(name, value))
		}
		res.status(statusCode).send(body)
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
		if (pageContext.errorWhileRendering) {
			if (!pageContext.httpResponse) {
				throw pageContext.errorWhileRendering
			}
		}
		const { httpResponse } = pageContext
		if (!httpResponse) {
			return next()
		}
		const { body, statusCode, headers, earlyHints } = httpResponse
		if (earlyHints103 === true && res.writeEarlyHints) {
			res.writeEarlyHints({ link: earlyHints.map((e) => e.earlyHintLink) })
		}
		if (headers) {
			headers.forEach(([name, value]) => res.setHeader(name, value))
		}
		res.status(statusCode).send(body)
  	})

	app.post('/api/inscription', async function (req, res) {
		if (creationCompte === 1) {
			const identifiant = req.body.identifiant
			if (identifiant.match(/^[\w-]+$/)) {
				const motdepasse = req.body.motdepasse
				const email = req.body.email.toLowerCase()
				let reponse = await db.EXISTS('utilisateurs:' + identifiant)
				if (reponse === null) {
					res.send('erreur'); return false
				} else if (reponse === 0) {
					reponse = await db.EXISTS('emails:' + email)
					if (reponse === null) {
						res.send('erreur'); return false
					} else if (reponse === 0 && validationInscription === 1) {
						let codeActivation = randomBytes(18)
						codeActivation = codeActivation.toString('hex')
						const hash = await bcrypt.hash(motdepasse, 10)
						const date = dayjs().format()
						let langue = 'fr'
						if (req.session.hasOwnProperty('langue') && req.session.langue !== '' && req.session.langue !== undefined) {
							langue = req.session.langue
						}
						await db
						.multi()
						.HSET('activations:' + codeActivation, ['id', identifiant, 'motdepasse', hash, 'date', date, 'email', email, 'langue', langue])
						.EXPIRE('activations:' + codeActivation, 43200)
						.exec()
						const message = {
							from: '"La Digitale" <' + process.env.EMAIL_ADDRESS + '>',
							to: '"Moi" <' + email + '>',
							subject: 'Activation de votre compte Digiwall',
							html: '<p>Vous avez créé un compte Digiwall ayant pour identifiant : <strong>' + identifiant + '</strong></p><p>Cliquez sur ce lien pour activer votre compte : <a href="' + hote + '/activation/' + codeActivation + '" target="_blank">' + hote + '/activation/' + codeActivation + '</a>.</p><p>Veuillez ignorer ce message si vous n\'êtes pas à l\'origine de cette création de compte.</p><p>La Digitale</p>'
						}
						transporter.sendMail(message, async function (err) {
							if (err) {
								res.send('erreur_email')
							} else {
								res.send('activation_demandee')
							}
						})
					} else if (reponse === 0 && validationInscription === 0) {
						const hash = await bcrypt.hash(motdepasse, 10)
						const date = dayjs().format()
						let langue = 'fr'
						if (req.session.hasOwnProperty('langue') && req.session.langue !== '' && req.session.langue !== undefined) {
							langue = req.session.langue
						}
						await db
						.multi()
						.HSET('utilisateurs:' + identifiant, ['id', identifiant, 'motdepasse', hash, 'date', date, 'nom', '', 'email', email, 'langue', langue, 'affichage', 'liste', 'classement', 'date-asc', 'dossiers', JSON.stringify([])])
						.HSET('emails:' + email, 'identifiant', identifiant)
						.exec()
						req.session.identifiant = identifiant
						req.session.motdepasse = motdepasse
						req.session.nom = ''
						req.session.email = email
						req.session.langue = langue
						req.session.statut = 'utilisateur'
						req.session.cookie.expires = new Date(Date.now() + dureeSession)
						const message = {
							from: '"La Digitale" <' + process.env.EMAIL_ADDRESS + '>',
							to: email,
							subject: 'Nouveau compte Digiwall',
							html: '<p>Vous avez créé un compte Digiwall ayant pour identifiant : <strong>' + identifiant + '</strong></p><p>Conservez bien cet identifiant, il est nécessaire pour vous connecter à votre compte.</p><p>La Digitale</p>'
						}
						transporter.sendMail(message, async function (err) {
							if (err) {
								res.send('erreur_email')
							} else {
								res.send('compte_cree')
							}
						})

					} else {
						res.send('email_existe_deja')
					}
				} else {
					res.send('utilisateur_existe_deja')
				}
			} else {
				res.send('identifiant_invalide')
			}
		} else {
			res.send('non_autorise')
		}
	})

	app.get('/activation/:code', async function (req, res) {
		if (maintenance === true) {
			res.redirect('/maintenance')
			return false
		} else if (validationInscription === 0) {
			res.redirect('/')
			return false
		}
		const codeActivation = req.params.code
		let reponse = await db.EXISTS('activations:' + codeActivation)
		if (reponse === null) {
			res.redirect('/')
		} else if (reponse === 1) {
			let donnees = await db.HGETALL('activations:' + codeActivation)
			donnees = Object.assign({}, donnees)
			if (donnees === null) { res.redirect('/'); return false }
			const identifiant = donnees.id
			const email = donnees.email
			const motdepasse = donnees.motdepasse
			const date = donnees.date
			const langue = donnees.langue
			let reponse = await db.EXISTS('utilisateurs:' + identifiant)
			if (reponse === 0) {
				reponse = await db.EXISTS('emails:' + email)
				if (reponse === 0) {
					await db
					.multi()
					.HSET('utilisateurs:' + identifiant, ['id', identifiant, 'motdepasse', motdepasse, 'date', date, 'nom', '', 'email', email, 'langue', langue, 'affichage', 'liste', 'classement', 'date-asc', 'dossiers', JSON.stringify([])])
					.HSET('emails:' + email, 'identifiant', identifiant)
					.UNLINK('activations:' + codeActivation)
					.exec()
					const pageContextInit = {
						urlOriginal: req.originalUrl,
						hote: hote,
						langue: langue
					}
					const pageContext = await renderPage(pageContextInit)
					if (pageContext.errorWhileRendering) {
						if (!pageContext.httpResponse) {
							throw pageContext.errorWhileRendering
						}
					}
					const { httpResponse } = pageContext
					if (!httpResponse) {
						return next()
					}
					const { body, statusCode, headers, earlyHints } = httpResponse
					if (earlyHints103 === true && res.writeEarlyHints) {
						res.writeEarlyHints({ link: earlyHints.map((e) => e.earlyHintLink) })
					}
					if (headers) {
						headers.forEach(([name, value]) => res.setHeader(name, value))
					}
					res.status(statusCode).send(body)
				} else {
					res.redirect('/')
				}
			} else {
				res.redirect('/')
			}
		} else {
			res.redirect('/')
		}
	})

	app.post('/api/connexion', async function (req, res) {
		const identifiant = req.body.identifiant
		const motdepasse = req.body.motdepasse
		const reponse = await db.EXISTS('utilisateurs:' + identifiant)
		if (reponse === null) { 
			res.send('erreur_connexion')
		} else if (reponse === 1) {
			let donnees = await db.HGETALL('utilisateurs:' + identifiant)
			donnees = Object.assign({}, donnees)
			if (donnees === null) { res.send('erreur_connexion'); return false }
			let comparaison = false
			if (motdepasse.trim() !== '' && donnees.hasOwnProperty('motdepasse') && donnees.motdepasse.trim() !== '') {
				comparaison = await bcrypt.compare(motdepasse, donnees.motdepasse)
			}
			let comparaisonTemp = false
			if (donnees.hasOwnProperty('motdepassetemp') && donnees.motdepassetemp.trim() !== '' && motdepasse.trim() !== '') {
				comparaisonTemp = await bcrypt.compare(motdepasse, donnees.motdepassetemp)
			}
			if (comparaison === true || comparaisonTemp === true) {
				if (comparaisonTemp === true) {
					const hash = await bcrypt.hash(motdepasse, 10)
					await db.HSET('utilisateurs:' + identifiant, 'motdepasse', hash)
					await db.HDEL('utilisateurs:' + identifiant, 'motdepassetemp')
				}
				const nom = donnees.nom
				const langue = donnees.langue
				const email = donnees.email.toLowerCase()
				req.session.identifiant = identifiant
				req.session.motdepasse = motdepasse
				req.session.nom = nom
				req.session.email = email
				req.session.langue = langue
				req.session.statut = 'utilisateur'
				req.session.cookie.expires = new Date(Date.now() + dureeSession)
				res.json({ identifiant: identifiant })
			} else {
				res.send('erreur_connexion')
			}
		} else {
			res.send('erreur_connexion')
		}
	})

	app.post('/api/mot-de-passe-oublie', async function (req, res) {
		const email = req.body.email.toLowerCase().trim()
		let donnees = await db.HGETALL('emails:' + email)
		donnees = Object.assign({}, donnees)
		if (donnees !== null) {
			const identifiant = donnees.identifiant
			const motdepasse = genererMotDePasse(8)
			const message = {
				from: '"La Digitale" <' + process.env.EMAIL_ADDRESS + '>',
				to: email,
				subject: 'Mot de passe Digiwall',
				html: '<p>Votre nouveau mot de passe : ' + motdepasse + '</p><p>Identifiant : ' + identifiant + '</p>'
			}
			transporter.sendMail(message, async function (err) {
				if (err) {
					res.send('erreur_email')
				} else {
					const hash = await bcrypt.hash(motdepasse, 10)
					await db.HSET('utilisateurs:' + identifiant, 'motdepassetemp', hash)
					res.send('message_envoye')
				}
			})
		} else {
			res.send('email_invalide')
		}
	})

	app.post('/api/deconnexion', function (req, res) {
		supprimerSession(req)
		res.send('deconnecte')
	})

	app.post('/api/recuperer-donnees-auteur', async function (req, res) {
		const identifiant = req.body.identifiant
		const mur = req.body.mur
		let donnees = await db.HGETALL('murs:' + mur)
		donnees = Object.assign({}, donnees)
		if (donnees === null || !donnees.hasOwnProperty('identifiant')) { res.send('erreur'); return false }
		if (req.session.identifiant === identifiant && await verifierAdmin(mur, donnees, req.session) === true) {
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
		} else {
			res.send('non_autorise')
		}
	})

	app.post('/api/recuperer-donnees-mur', async function (req, res) {
		const id = req.body.id
		const token = req.body.token
		const identifiant = req.body.identifiant
		const statut = req.body.statut
		const murs = req.body.murs
		const resultat = await db.EXISTS('murs:' + id)
		if (resultat === null) { res.send('erreur'); return false }
		let mur = await db.HGETALL('murs:' + id)
		mur = Object.assign({}, mur)
		if (resultat === 1 && mur !== null) {
			recupererDonneesMur(id, token, identifiant, statut, murs, res)
		} else {
			res.send('erreur')
		}
	})

	app.post('/api/creer-mur', async function (req, res) {
		if (maintenance === true) {
			res.redirect('/maintenance')
			return false
		}
		const identifiant = req.body.identifiant
		if (req.session.identifiant && req.session.identifiant === identifiant && req.session.statut === 'utilisateur' && req.session.hasOwnProperty('motdepasse') && req.session.motdepasse !== '') {
			let donneesUtilisateur = await db.HGETALL('utilisateurs:' + identifiant)
			donneesUtilisateur = Object.assign({}, donneesUtilisateur)
			if (donneesUtilisateur === null || !donneesUtilisateur.hasOwnProperty('motdepasse')) { res.send('erreur_creation'); return false }
			if (await bcrypt.compare(req.session.motdepasse, donneesUtilisateur.motdepasse)) {
				const titre = req.body.titre
				const token = Math.random().toString(16).slice(10)
				const slug = definirSlug(titre)
				const date = dayjs().format()
				const destination = req.body.dossier
				const resultat = await db.EXISTS('mur')
				if (resultat === null) { res.send('erreur_creation'); return false }
				if (resultat === 1) {
					const reponse = await db.GET('mur')
					if (reponse === null) { res.send('erreur_creation'); return false }
					const id = parseInt(reponse) + 1
					creerMur(res, id, token, slug, titre, date, identifiant, destination, donneesUtilisateur)
				} else {
					creerMur(res, 1, token, slug, titre, date, identifiant, destination, donneesUtilisateur)
				}
			} else {
				res.send('non_connecte')
			}
		} else {
			supprimerSession(req)
			res.send('non_connecte')
		}
	})

	app.post('/api/creer-mur-sans-compte', async function (req, res) {
		if (maintenance === true) {
			res.redirect('/maintenance')
			return false
		}
		if (creationMurSansCompte === 1) {
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
			req.session.motdepasse = ''
			if (!req.session.hasOwnProperty('acces')) {
				req.session.acces = []
			}
			if (!req.session.hasOwnProperty('murs')) {
				req.session.murs = []
			}
			if (!req.session.hasOwnProperty('blocsAutorises')) {
				req.session.blocsAutorises = []
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
			const resultat = await db.EXISTS('mur')
			if (resultat === null) { res.send('erreur_creation'); return false }
			if (resultat === 1) {
				const reponse = await db.GET('mur')
				if (reponse === null) { res.send('erreur_creation'); return false }
				const id = parseInt(reponse) + 1
				creerMurSansCompte(req, res, id, token, slug, titre, hash, date, identifiant, nom, langue, '')
			} else {
				creerMurSansCompte(req, res, 1, token, slug, titre, hash, date, identifiant, nom, langue, '')
			}
		} else {
			res.send('non_autorise')
		}
	})

	app.post('/api/deconnecter-mur', function (req, res) {
		const identifiant = req.body.identifiant
		if (req.session.identifiant && req.session.identifiant === identifiant) {
			req.session.identifiant = ''
			req.session.motdepasse = ''
			req.session.statut = ''
			res.send('deconnecte')
		} else {
			res.send('non_connecte')
		}
	})

	app.post('/api/modifier-mot-de-passe-mur', async function (req, res) {
		if (maintenance === true) {
			res.redirect('/maintenance')
			return false
		}
		const identifiant = req.body.identifiant
		if (req.session.identifiant && req.session.identifiant === identifiant) {
			const mur = req.body.mur
			let donnees = await db.HGETALL('murs:' + mur)
			donnees = Object.assign({}, donnees)
			if (donnees === null) { res.send('erreur'); return false }
			const motdepasse = req.body.motdepasse
			const nouveaumotdepasse = req.body.nouveaumotdepasse
			if (motdepasse.trim() !== '' && nouveaumotdepasse.trim() !== '' && donnees.hasOwnProperty('motdepasse') && donnees.motdepasse.trim() !== '' && await bcrypt.compare(motdepasse, donnees.motdepasse)) {
				const hash = await bcrypt.hash(nouveaumotdepasse, 10)
				await db.HSET('murs:' + mur, 'motdepasse', hash)
				res.send('motdepasse_modifie')
			} else {
				res.send('motdepasse_incorrect')
			}
		} else {
			res.send('non_connecte')
		}
	})

	app.post('/api/ajouter-mur-favoris', async function (req, res) {
		const identifiant = req.body.identifiant
		if (req.session.identifiant && req.session.identifiant === identifiant && req.session.statut === 'utilisateur' && req.session.hasOwnProperty('motdepasse') && req.session.motdepasse !== '') {
			let donneesUtilisateur = await db.HGETALL('utilisateurs:' + identifiant)
			donneesUtilisateur = Object.assign({}, donneesUtilisateur)
			if (donneesUtilisateur === null || !donneesUtilisateur.hasOwnProperty('motdepasse')) { res.send('erreur'); return false }
			if (await bcrypt.compare(req.session.motdepasse, donneesUtilisateur.motdepasse)) {
				const mur = req.body.murId
				await db.SADD('murs-favoris:' + identifiant, mur.toString())
				res.send('mur_ajoute_favoris')
			} else {
				res.send('non_connecte')
			}
		} else {
			supprimerSession(req)
			res.send('non_connecte')
		}
	})

	app.post('/api/supprimer-mur-favoris', async function (req, res) {
		const identifiant = req.body.identifiant
		if (req.session.identifiant && req.session.identifiant === identifiant && req.session.statut === 'utilisateur' && req.session.hasOwnProperty('motdepasse') && req.session.motdepasse !== '') {
			let donneesUtilisateur = await db.HGETALL('utilisateurs:' + identifiant)
			donneesUtilisateur = Object.assign({}, donneesUtilisateur)
			if (donneesUtilisateur === null || !donneesUtilisateur.hasOwnProperty('motdepasse')) { res.send('erreur'); return false }
			if (await bcrypt.compare(req.session.motdepasse, donneesUtilisateur.motdepasse)) {
				const mur = req.body.murId
				await db.SREM('murs-favoris:' + identifiant, mur.toString())
				res.send('mur_supprime_favoris')
			} else {
				res.send('non_connecte')
			}
		} else {
			supprimerSession(req)
			res.send('non_connecte')
		}
	})

	app.post('/api/deplacer-mur', async function (req, res) {
		const identifiant = req.body.identifiant
		if (req.session.identifiant && req.session.identifiant === identifiant && req.session.statut === 'utilisateur' && req.session.hasOwnProperty('motdepasse') && req.session.motdepasse !== '') {
			let donneesUtilisateur = await db.HGETALL('utilisateurs:' + identifiant)
			donneesUtilisateur = Object.assign({}, donneesUtilisateur)
			if (donneesUtilisateur === null || !donneesUtilisateur.hasOwnProperty('motdepasse')) { res.send('erreur'); return false }
			if (await bcrypt.compare(req.session.motdepasse, donneesUtilisateur.motdepasse)) {
				const murId = req.body.murId
				const destination = req.body.destination
				const dossiers = JSON.parse(donneesUtilisateur.dossiers)
				dossiers.forEach(function (dossier, indexDossier) {
					if (dossier.murs.includes(murId)) {
						const indexMur = dossier.murs.indexOf(murId)
						dossiers[indexDossier].murs.splice(indexMur, 1)
					}
					if (dossier.id === destination) {
						dossiers[indexDossier].murs.push(murId)
					}
				})
				await db.HSET('utilisateurs:' + identifiant, 'dossiers', JSON.stringify(dossiers))
				res.send('mur_deplace')
			} else {
				res.send('non_connecte')
			}
		} else {
			supprimerSession(req)
			res.send('non_connecte')
		}
	})

	app.post('/api/dupliquer-mur', async function (req, res) {
		if (maintenance === true) {
			res.redirect('/maintenance')
			return false
		}
		const identifiant = req.body.identifiant
		if (req.session.identifiant && req.session.identifiant === identifiant && req.session.statut === 'utilisateur' && req.session.hasOwnProperty('motdepasse') && req.session.motdepasse !== '') {
			const mur = req.body.murId
			if (await verifierAdminUtilisateur(mur, identifiant, req.session.motdepasse) === true) {
				const num = await db.GET('mur')
				if (num === null) { res.send('erreur_duplication'); return false }
				const id = parseInt(num) + 1
				const dossier = path.join(__dirname, '..', '/static' + definirCheminFichiers())
				checkDiskSpace(dossier).then(async function (diskSpace) {
					const espace = Math.round((diskSpace.free / diskSpace.size) * 100)
					if (stockage === 'fs' && espace < minimumEspaceDisque) {
						res.send('erreur_espace_disque')
					} else {
						const resultat = await db.EXISTS('murs:' + mur)
						if (resultat === null) { res.send('erreur_duplication'); return false }
						if (resultat === 1) {
							let donnees = await db.HGETALL('murs:' + mur)
							donnees = Object.assign({}, donnees)
							if (donnees === null || !donnees.hasOwnProperty('identifiant')) { res.send('erreur_duplication'); return false }
							const donneesBlocs = []
							const blocs = await db.ZRANGE('blocs:' + mur, 0, -1)
							if (blocs === null) { res.send('erreur_duplication'); return false }
							for (const [indexBloc, bloc] of blocs.entries()) {
								const donneesBloc = new Promise(async function (resolve) {
									let infos = await db.HGETALL('contenu-blocs:' + mur + ':' + bloc)
									infos = Object.assign({}, infos)
									if (infos === null) { resolve({}); return false }
									const date = dayjs().format()
									if (infos.hasOwnProperty('vignette') && definirVignettePersonnalisee(infos.vignette) === true) {
										infos.vignette = path.basename(infos.vignette)
									}
									if (infos.hasOwnProperty('iframe') && infos.iframe !== '' && infos.iframe.includes(etherpad)) {
										const etherpadId = infos.iframe.replace(etherpad + '/p/', '')
										const destinationId = 'mur-' + id + '-' + Math.random().toString(16).slice(2)
										const url = etherpad + '/api/1.2.14/copyPad?apikey=' + etherpadApi + '&sourceID=' + etherpadId + '&destinationID=' + destinationId
										axios.get(url)
										infos.iframe = etherpad + '/p/' + destinationId
										infos.media = etherpad + '/p/' + destinationId
									}
									let motdepasse = ''
									if (infos.hasOwnProperty('motdepasse')) {
										motdepasse = infos.motdepasse
									}
									let epinglee = 'non'
									if (infos.hasOwnProperty('epinglee')) {
										epinglee = infos.epinglee
									}
									const blocId = 'bloc-id-' + (new Date()).getTime() + Math.random().toString(16).slice(10)
									await db
									.multi()
									.HSET('contenu-blocs:' + id + ':' + blocId, ['id', infos.id, 'bloc', blocId, 'typeBloc', infos.typeBloc, 'titre', infos.titre, 'texte', infos.texte, 'media', infos.media, 'iframe', infos.iframe, 'type', infos.type, 'source', infos.source, 'vignette', infos.vignette, 'vignetteActivee', infos.vignetteActivee, 'mediaExtra', infos.mediaExtra, 'medias', infos.medias, 'edition', infos.edition, 'date', date, 'identifiant', infos.identifiant, 'commentaires', 0, 'evaluations', 0, 'colonne', infos.colonne, 'visibilite', infos.visibilite, 'motdepasse', motdepasse, 'epinglee', epinglee, 'couleur', infos.couleur])
									.ZADD('blocs:' + id, [{ score: indexBloc, value: blocId }])
									.exec()
									resolve(blocId)
								})
								donneesBlocs.push(donneesBloc)
							}
							Promise.all(donneesBlocs).then(async function () {
								const token = Math.random().toString(16).slice(10)
								const slug = definirSlug(donnees.titre)
								const date = dayjs().format()
								const code = Math.floor(100000 + Math.random() * 900000)
								if (!donnees.fond.includes('/img/') && donnees.fond.substring(0, 1) !== '#' && donnees.fond !== '') {
									donnees.fond = path.basename(donnees.fond)
								}
								let epinglage = 'desactive'
								if (donnees.hasOwnProperty('epinglage')) {
									epinglage = donnees.epinglage
								}
								if (donnees.hasOwnProperty('code')) {
									await db
									.multi()
									.INCR('mur')
									.HSET('murs:' + id, ['id', id, 'token', token, 'titre', 'Copie de ' + donnees.titre, 'identifiant', identifiant, 'fond', donnees.fond, 'acces', donnees.acces, 'motdepasseAdmin', donnees.motdepasseAdmin, 'code', code, 'contributions', donnees.contributions, 'affichage', donnees.affichage, 'registreActivite', donnees.registreActivite, 'conversation', donnees.conversation, 'listeUtilisateurs', donnees.listeUtilisateurs, 'editionNom', donnees.editionNom, 'fichiers', donnees.fichiers, 'enregistrements', donnees.enregistrements, 'liens', donnees.liens, 'documents', donnees.documents, 'commentaires', donnees.commentaires, 'evaluations', donnees.evaluations, 'verrouillage', donnees.verrouillage, 'epinglage', epinglage, 'copieBloc', donnees.copieBloc, 'ordre', donnees.ordre, 'largeur', donnees.largeur, 'date', date, 'colonnes', donnees.colonnes, 'affichageColonnes', donnees.affichageColonnes, 'bloc', donnees.bloc, 'activite', 0, 'admins', JSON.stringify([]), 'vues', 0, 'digidrive', 0])
									.SADD('murs-crees:' + identifiant, id.toString())
									.SADD('utilisateurs-murs:' + id, identifiant)
									.exec()
								} else {
									await db
									.multi()
									.INCR('mur')
									.HSET('murs:' + id, ['id', id, 'token', token, 'titre', 'Copie de ' + donnees.titre, 'identifiant', identifiant, 'fond', donnees.fond, 'acces', donnees.acces, 'motdepasseAdmin', donnees.motdepasseAdmin, 'contributions', donnees.contributions, 'affichage', donnees.affichage, 'registreActivite', donnees.registreActivite, 'conversation', donnees.conversation, 'listeUtilisateurs', donnees.listeUtilisateurs, 'editionNom', donnees.editionNom, 'fichiers', donnees.fichiers, 'enregistrements', donnees.enregistrements, 'liens', donnees.liens, 'documents', donnees.documents, 'commentaires', donnees.commentaires, 'evaluations', donnees.evaluations, 'verrouillage', donnees.verrouillage, 'epinglage', epinglage, 'copieBloc', donnees.copieBloc, 'ordre', donnees.ordre, 'largeur', donnees.largeur, 'date', date, 'colonnes', donnees.colonnes, 'affichageColonnes', donnees.affichageColonnes, 'bloc', donnees.bloc, 'activite', 0, 'admins', JSON.stringify([]), 'vues', 0, 'digidrive', 0])
									.SADD('murs-crees:' + identifiant, id.toString())
									.SADD('utilisateurs-murs:' + id, identifiant)
									.exec()
								}
								if (stockage === 'fs' && await fs.pathExists(path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + mur))) {
									await fs.copy(path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + mur), path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + id))
								} else if (stockage === 's3') {
									const liste = await s3Client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: mur + '/' }))
									if (liste !== null && liste.hasOwnProperty('Contents') && liste.Contents instanceof Array) {
										for (let i = 0; i < liste.Contents.length; i++) {
											await s3Client.send(new CopyObjectCommand({ Bucket: bucket, Key: id + '/' + liste.Contents[i].Key.replace(mur + '/', ''), CopySource: '/' + bucket + '/' + liste.Contents[i].Key, ACL: 'public-read' }))
										}
									}
								}
								const destination = req.body.dossier
								if (destination !== '') {
									let donneesUtilisateur = await db.HGETALL('utilisateurs:' + identifiant)
									donneesUtilisateur = Object.assign({}, donneesUtilisateur)
									if (donneesUtilisateur !== null) {
										const dossiers = JSON.parse(donneesUtilisateur.dossiers)
										dossiers.forEach(function (dossier, indexDossier) {
											if (dossier.id === destination) {
												dossiers[indexDossier].murs.push(id)
											}
										})
										await db.HSET('utilisateurs:' + identifiant, 'dossiers', JSON.stringify(dossiers))
									}
								}
								res.json({ id: id, token: token, slug: slug, titre: 'Copie de ' + donnees.titre, identifiant: identifiant, fond: donnees.fond, acces: donnees.acces, motdepasseAdmin: donnees.motdepasseAdmin, code: code, contributions: donnees.contributions, affichage: donnees.affichage, registreActivite: donnees.registreActivite, conversation: donnees.conversation, listeUtilisateurs: donnees.listeUtilisateurs, editionNom: donnees.editionNom, fichiers: donnees.fichiers, enregistrements: donnees.enregistrements, liens: donnees.liens, documents: donnees.documents, commentaires: donnees.commentaires, evaluations: donnees.evaluations, verrouillage: donnees.verrouillage, epinglage: epinglage, copieBloc: donnees.copieBloc, ordre: donnees.ordre, largeur: donnees.largeur, date: date, colonnes: donnees.colonnes, affichageColonnes: donnees.affichageColonnes, bloc: donnees.bloc, activite: 0, admins: [], vues: 0 })
							})
						}
					}
				})
			} else {
				res.send('non_connecte')
			}
		} else {
			supprimerSession(req)
			res.send('non_connecte')
		}
	})

	app.post('/api/exporter-mur', async function (req, res) {
		const identifiant = req.body.identifiant
		const motdepasseAdmin = req.body.admin
		const motdepasseEnvAdmin = process.env.ADMIN_PASSWORD
		let admin = false
		if (motdepasseAdmin !== '' && motdepasseAdmin === motdepasseEnvAdmin) {
			admin = true
		}
		if ((req.session.identifiant && req.session.identifiant === identifiant && ((req.session.statut === 'utilisateur' && req.session.hasOwnProperty('motdepasse') && req.session.motdepasse !== '') || req.session.statut === 'auteur')) || admin) {
			const id = req.body.murId
			const resultat = await db.EXISTS('murs:' + id)
			if (resultat === null) { res.send('erreur_export'); return false }
			if (resultat === 1) {
				let donneesMur = await db.HGETALL('murs:' + id)
				donneesMur = Object.assign({}, donneesMur)
				if (donneesMur === null) { res.send('erreur_export'); return false }
				if (admin || await verifierAdmin(id, donneesMur, req.session) === true) {
					exporterMur(req, res, id, 'erreur_export')
				} else {
					res.send('non_autorise')
				}
			} else {
				res.send('mur_inexistant')
			}
		} else {
			supprimerSession(req)
			res.send('non_connecte')
		}
	})

	app.post('/api/importer-mur', async function (req, res) {
		if (maintenance === true) {
			res.redirect('/maintenance')
			return false
		}
		const identifiant = req.session.identifiant
		if (identifiant && req.session.statut === 'utilisateur' && req.session.hasOwnProperty('motdepasse') && req.session.motdepasse !== '') {
			let donneesUtilisateur = await db.HGETALL('utilisateurs:' + identifiant)
			donneesUtilisateur = Object.assign({}, donneesUtilisateur)
			if (donneesUtilisateur === null || !donneesUtilisateur.hasOwnProperty('motdepasse')) { res.send('erreur_import'); return false }
			if (await bcrypt.compare(req.session.motdepasse, donneesUtilisateur.motdepasse)) {
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
							const resultat = await db.GET('mur')
							if (resultat === null) { res.send('erreur_import'); return false }
							const id = parseInt(resultat) + 1
							const dossier = path.join(__dirname, '..', '/static' + definirCheminFichiers())
							checkDiskSpace(dossier).then(async function (diskSpace) {
								const espace = Math.round((diskSpace.free / diskSpace.size) * 100)
								if (stockage === 'fs' && espace < minimumEspaceDisque) {
									res.send('erreur_espace_disque')
								} else {
									const chemin = path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + id)
									const donneesBlocs = []
									if (stockage === 'fs') {
										await fs.mkdirp(chemin)
									}
									for (const [indexBloc, bloc] of donnees.blocs.entries()) {
										const donneesBloc = new Promise(async function (resolve) {
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
												if (definirVignettePersonnalisee(bloc.vignette) === true) {
													bloc.vignette = path.basename(bloc.vignette)
												}
												let motdepasse = ''
												if (bloc.hasOwnProperty('motdepasse')) {
													motdepasse = bloc.motdepasse
												}
												let epinglee = 'non'
												if (bloc.hasOwnProperty('epinglee')) {
													epinglee = bloc.epinglee
												}
												const blocId = 'bloc-id-' + (new Date()).getTime() + Math.random().toString(16).slice(10)
												await db
												.multi()
												.HSET('contenu-blocs:' + id + ':' + blocId, ['id', bloc.id, 'bloc', blocId, 'typeBloc', bloc.typeBloc, 'titre', bloc.titre, 'texte', bloc.texte, 'media', bloc.media, 'iframe', bloc.iframe, 'type', bloc.type, 'source', bloc.source, 'vignette', bloc.vignette, 'vignetteActivee', bloc.vignetteActivee, 'mediaExtra', bloc.mediaExtra, 'medias', bloc.medias, 'edition', bloc.edition, 'date', date, 'identifiant', bloc.identifiant, 'commentaires', commentaires, 'evaluations', evaluations, 'colonne', bloc.colonne, 'visibilite', bloc.visibilite, 'motdepasse', motdepasse, 'epinglee', epinglee, 'couleur', bloc.couleur])
												.ZADD('blocs:' + id, [{ score: indexBloc, value: blocId }])
												.exec()
												if (parametres.commentaires === true) {
													for (const commentaire of bloc.listeCommentaires) {
														if (commentaire.hasOwnProperty('id') && commentaire.hasOwnProperty('identifiant') && commentaire.hasOwnProperty('date') && commentaire.hasOwnProperty('texte')) {
															await db.ZADD('commentaires:' + blocId, [{ score: commentaire.id, value: JSON.stringify(commentaire) }])
														}
													}
												}
												if (parametres.evaluations === true) {
													for (const evaluation of bloc.listeEvaluations) {
														if (evaluation.hasOwnProperty('id') && evaluation.hasOwnProperty('identifiant') && evaluation.hasOwnProperty('date') && evaluation.hasOwnProperty('etoiles')) {
															await db.ZADD('evaluations:' + blocId, [{ score: evaluation.id, value: JSON.stringify(evaluation) }])
														}
													}
												}
												if (stockage === 'fs' && bloc.hasOwnProperty('media') && bloc.media !== '' && bloc.type !== 'embed' && bloc.type !== 'lien' && await fs.pathExists(path.normalize(cible + '/fichiers/' + bloc.media))) {
													await fs.copy(path.normalize(cible + '/fichiers/' + bloc.media), path.normalize(chemin + '/' + bloc.media, { overwrite: true }))
												} else if (stockage === 's3' && bloc.hasOwnProperty('media') && bloc.media !== '' && bloc.type !== 'embed' && bloc.type !== 'lien' && await fs.pathExists(path.normalize(cible + '/fichiers/' + bloc.media))) {
													const buffer = await fs.readFile(path.normalize(cible + '/fichiers/' + bloc.media))
													await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: id + '/' + bloc.media, Body: buffer, ACL: 'public-read' }))
												}
												if (stockage === 'fs' && bloc.hasOwnProperty('mediaExtra') && bloc.mediaExtra !== '' && await fs.pathExists(path.normalize(cible + '/fichiers/' + bloc.mediaExtra))) {
													await fs.copy(path.normalize(cible + '/fichiers/' + bloc.mediaExtra), path.normalize(chemin + '/' + bloc.mediaExtra, { overwrite: true }))
												} else if (stockage === 's3' && bloc.hasOwnProperty('mediaExtra') && bloc.mediaExtra !== '' && await fs.pathExists(path.normalize(cible + '/fichiers/' + bloc.mediaExtra))) {
													const buffer = await fs.readFile(path.normalize(cible + '/fichiers/' + bloc.mediaExtra))
													await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: id + '/' + bloc.mediaExtra, Body: buffer, ACL: 'public-read' }))
												}
												if (bloc.hasOwnProperty('medias')) {
													const medias = JSON.parse(bloc.medias)
													for (let i = 0; i < medias.length; i++) {
														if (stockage === 'fs' && medias[i].hasOwnProperty('fichier') && medias[i].fichier !== '' && await fs.pathExists(path.normalize(cible + '/fichiers/' + medias[i].fichier))) {
															await fs.copy(path.normalize(cible + '/fichiers/' + medias[i].fichier), path.normalize(chemin + '/' + medias[i].fichier, { overwrite: true }))
														} else if (stockage === 's3' && medias[i].hasOwnProperty('fichier') && medias[i].fichier !== '' && await fs.pathExists(path.normalize(cible + '/fichiers/' + medias[i].fichier))) {
															const buffer = await fs.readFile(path.normalize(cible + '/fichiers/' + medias[i].fichier))
															await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: id + '/' + medias[i].fichier, Body: buffer, ACL: 'public-read' }))
														}
													}
												}
												if (stockage === 'fs' && bloc.hasOwnProperty('vignette') && definirVignettePersonnalisee(bloc.vignette) === true && await fs.pathExists(path.normalize(cible + '/fichiers/' + path.basename(bloc.vignette)))) {
													await fs.copy(path.normalize(cible + '/fichiers/' + path.basename(bloc.vignette)), path.normalize(chemin + '/' + path.basename(bloc.vignette), { overwrite: true }))
												} else if (stockage === 's3' && bloc.hasOwnProperty('vignette') && definirVignettePersonnalisee(bloc.vignette) === true && await fs.pathExists(path.normalize(cible + '/fichiers/' + path.basename(bloc.vignette)))) {
													const buffer = await fs.readFile(path.normalize(cible + '/fichiers/' + path.basename(bloc.vignette)))
													await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: id + '/' + path.basename(bloc.vignette), Body: buffer, ACL: 'public-read' }))
												}
												resolve({ bloc: bloc.bloc, blocId: blocId })
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
										const code = Math.floor(100000 + Math.random() * 900000)
										let activiteId = 0
										if (parametres.activite === true) {
											activiteId = donnees.mur.activite
										}
										if (stockage === 'fs' && !donnees.mur.fond.includes('/img/') && donnees.mur.fond.substring(0, 1) !== '#' && donnees.mur.fond !== '' && await fs.pathExists(path.normalize(cible + '/fichiers/' + path.basename(donnees.mur.fond)))) {
											await fs.copy(path.normalize(cible + '/fichiers/' + path.basename(donnees.mur.fond)), path.normalize(chemin + '/' + path.basename(donnees.mur.fond), { overwrite: true }))
										} else if (stockage === 's3' && !donnees.mur.fond.includes('/img/') && donnees.mur.fond.substring(0, 1) !== '#' && donnees.mur.fond !== '' && await fs.pathExists(path.normalize(cible + '/fichiers/' + path.basename(donnees.mur.fond)))) {
											const buffer = await fs.readFile(path.normalize(cible + '/fichiers/' + path.basename(donnees.mur.fond)))
											await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: id + '/' + path.basename(donnees.mur.fond), Body: buffer, ACL: 'public-read' }))
										}
										let epinglage = 'desactive'
										if (donnees.mur.hasOwnProperty('epinglage')) {
											epinglage = donnees.mur.epinglage
										}
										await db
										.multi()
										.INCR('mur')
										.HSET('murs:' + id, ['id', id, 'token', token, 'titre', donnees.mur.titre, 'identifiant', identifiant, 'fond', donnees.mur.fond, 'acces', donnees.mur.acces, 'motdepasseAdmin', '', 'code', code, 'contributions', donnees.mur.contributions, 'affichage', donnees.mur.affichage, 'registreActivite', donnees.mur.registreActivite, 'conversation', donnees.mur.conversation, 'listeUtilisateurs', donnees.mur.listeUtilisateurs, 'editionNom', donnees.mur.editionNom, 'fichiers', donnees.mur.fichiers, 'enregistrements', donnees.mur.enregistrements, 'liens', donnees.mur.liens, 'documents', donnees.mur.documents, 'commentaires', donnees.mur.commentaires, 'evaluations', donnees.mur.evaluations, 'verrouillage', donnees.mur.verrouillage, 'epinglage', epinglage, 'copieBloc', donnees.mur.copieBloc, 'ordre', donnees.mur.ordre, 'largeur', donnees.mur.largeur, 'date', date, 'colonnes', donnees.mur.colonnes, 'affichageColonnes', donnees.mur.affichageColonnes, 'bloc', donnees.mur.bloc, 'activite', activiteId, 'admins', JSON.stringify([]), 'vues', 0, 'digidrive', 0])
										.SADD('murs-crees:' + identifiant, id.toString())
										.SADD('utilisateurs-murs:' + id, identifiant)
										.exec()
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
													await db.ZADD('activite:' + id, [{ score: activite.id, value: JSON.stringify(activite) }])
												}
											}
										}
										await fs.remove(source)
										await fs.remove(cible)
										res.json({ id: id, token: token, slug: slug, titre: donnees.mur.titre, identifiant: identifiant, fond: donnees.mur.fond, acces: donnees.mur.acces, motdepasseAdmin: donnees.mur.motdepasseAdmin, code: code, contributions: donnees.mur.contributions, affichage: donnees.mur.affichage, registreActivite: donnees.mur.registreActivite, conversation: donnees.mur.conversation, listeUtilisateurs: donnees.mur.listeUtilisateurs, editionNom: donnees.mur.editionNom, fichiers: donnees.mur.fichiers, enregistrements: donnees.mur.enregistrements, liens: donnees.mur.liens, documents: donnees.mur.documents, commentaires: donnees.mur.commentaires, evaluations: donnees.mur.evaluations, verrouillage: donnees.mur.verrouillage, epinglage: epinglage, copieBloc: donnees.mur.copieBloc, ordre: donnees.mur.ordre, largeur: donnees.mur.largeur, date: date, colonnes: donnees.mur.colonnes, affichageColonnes: donnees.mur.affichageColonnes, bloc: donnees.mur.bloc, activite: activiteId, admins: [], vues: 0 })
									})
								}
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
			} else {
				res.send('non_connecte')
			}
		} else {
			supprimerSession(req)
			res.send('non_connecte')
		}
	})

	app.post('/api/importer-mur-sans-compte', async function (req, res) {
		if (maintenance === true) {
			res.redirect('/maintenance')
			return false
		}
		const identifiant = req.session.identifiant
		if (identifiant && req.session.statut === 'auteur') {
			televerserTemp(req, res, async function (err) {
				if (err) { res.send('erreur_import'); return false }
				const id = req.body.mur
				if (req.session.hasOwnProperty('murs') && req.session.murs.includes(parseInt(id))) {
					try {
						const source = path.join(__dirname, '..', '/static/temp/' + req.file.filename)
						const cible = path.join(__dirname, '..', '/static/temp/archive-' + Math.floor((Math.random() * 100000) + 1))
						await extract(source, { dir: cible })
						const donnees = await fs.readJson(path.normalize(cible + '/donnees.json'))
						const parametres = JSON.parse(req.body.parametres)
						// Vérification des clés des données
						if (donnees.hasOwnProperty('mur') && donnees.hasOwnProperty('blocs') && donnees.hasOwnProperty('activite') && donnees.mur.hasOwnProperty('id') && donnees.mur.hasOwnProperty('token') && donnees.mur.hasOwnProperty('titre') && donnees.mur.hasOwnProperty('identifiant') && donnees.mur.hasOwnProperty('fond') && donnees.mur.hasOwnProperty('acces') && donnees.mur.hasOwnProperty('motdepasseAdmin') && donnees.mur.hasOwnProperty('contributions') && donnees.mur.hasOwnProperty('affichage') && donnees.mur.hasOwnProperty('registreActivite') && donnees.mur.hasOwnProperty('conversation') && donnees.mur.hasOwnProperty('listeUtilisateurs') && donnees.mur.hasOwnProperty('editionNom') && donnees.mur.hasOwnProperty('enregistrements') && donnees.mur.hasOwnProperty('ordre') && donnees.mur.hasOwnProperty('largeur') && donnees.mur.hasOwnProperty('affichageColonnes') && donnees.mur.hasOwnProperty('vues') && donnees.mur.hasOwnProperty('fichiers') && donnees.mur.hasOwnProperty('liens') && donnees.mur.hasOwnProperty('documents') && donnees.mur.hasOwnProperty('commentaires') && donnees.mur.hasOwnProperty('evaluations') && donnees.mur.hasOwnProperty('verrouillage') && donnees.mur.hasOwnProperty('copieBloc') && donnees.mur.hasOwnProperty('date') && donnees.mur.hasOwnProperty('colonnes') && donnees.mur.hasOwnProperty('bloc') && donnees.mur.hasOwnProperty('activite')) {
							if (parametres.contenu === 'remplacer') {
								const blocs = await db.ZRANGE('blocs:' + id, 0, -1)
								if (blocs === null) { res.send('erreur_import'); return false }
								// Supprimer données actuelles du mur
								for (let i = 0; i < blocs.length; i++) {
									await db
									.multi()
									.UNLINK('commentaires:' + blocs[i])
									.UNLINK('evaluations:' + blocs[i])
									.UNLINK('contenu-blocs:' + id + ':' + blocs[i])
									.exec()
								}
								await db
								.multi()
								.UNLINK('blocs:' + id)
								.UNLINK('activite:' + id)
								.UNLINK('dates-murs:' + id)
								.exec()
								const chemin = path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + id)
								if (stockage === 'fs') {
									await fs.emptyDir(chemin)
								}
								const donneesBlocs = []
								for (const [indexBloc, bloc] of donnees.blocs.entries()) {
									const donneesBloc = new Promise(async function (resolve) {
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
											if (bloc.hasOwnProperty('vignette') && definirVignettePersonnalisee(bloc.vignette) === true) {
												bloc.vignette = path.basename(bloc.vignette)
											}
											let motdepasse = ''
											if (bloc.hasOwnProperty('motdepasse')) {
												motdepasse = bloc.motdepasse
											}
											let epinglee = 'non'
											if (bloc.hasOwnProperty('epinglee')) {
												epinglee = bloc.epinglee
											}
											const blocId = 'bloc-id-' + (new Date()).getTime() + Math.random().toString(16).slice(10)
											await db
											.multi()
											.HSET('contenu-blocs:' + id + ':' + blocId, ['id', bloc.id, 'bloc', blocId, 'typeBloc', bloc.typeBloc, 'titre', bloc.titre, 'texte', bloc.texte, 'media', bloc.media, 'iframe', bloc.iframe, 'type', bloc.type, 'source', bloc.source, 'vignette', bloc.vignette, 'vignetteActivee', bloc.vignetteActivee, 'mediaExtra', bloc.mediaExtra, 'medias', bloc.medias, 'edition', bloc.edition, 'date', date, 'identifiant', bloc.identifiant, 'commentaires', commentaires, 'evaluations', evaluations, 'colonne', bloc.colonne, 'visibilite', bloc.visibilite, 'motdepasse', motdepasse, 'epinglee', epinglee, 'couleur', bloc.couleur])
											.ZADD('blocs:' + id, [{ score: indexBloc, value: blocId }])
											.exec()
											if (parametres.commentaires === true) {
												for (const commentaire of bloc.listeCommentaires) {
													if (commentaire.hasOwnProperty('id') && commentaire.hasOwnProperty('identifiant') && commentaire.hasOwnProperty('date') && commentaire.hasOwnProperty('texte')) {
														await db.ZADD('commentaires:' + blocId, [{ score: commentaire.id, value: JSON.stringify(commentaire) }])
													}
												}
											}
											if (parametres.evaluations === true) {
												for (const evaluation of bloc.listeEvaluations) {
													if (evaluation.hasOwnProperty('id') && evaluation.hasOwnProperty('identifiant') && evaluation.hasOwnProperty('date') && evaluation.hasOwnProperty('etoiles')) {
														await db.ZADD('evaluations:' + blocId, [{ score: evaluation.id, value: JSON.stringify(evaluation) }])
													}
												}
											}
											if (stockage === 'fs' && bloc.hasOwnProperty('media') && bloc.media !== '' && bloc.type !== 'embed' && bloc.type !== 'lien' && await fs.pathExists(path.normalize(cible + '/fichiers/' + bloc.media))) {
												await fs.copy(path.normalize(cible + '/fichiers/' + bloc.media), path.normalize(chemin + '/' + bloc.media, { overwrite: true }))
											} else if (stockage === 's3' && bloc.hasOwnProperty('media') && bloc.media !== '' && bloc.type !== 'embed' && bloc.type !== 'lien' && await fs.pathExists(path.normalize(cible + '/fichiers/' + bloc.media))) {
												const buffer = await fs.readFile(path.normalize(cible + '/fichiers/' + bloc.media))
												await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: id + '/' + bloc.media, Body: buffer, ACL: 'public-read' }))
											}
											if (stockage === 'fs' && bloc.hasOwnProperty('mediaExtra') && bloc.mediaExtra !== '' && await fs.pathExists(path.normalize(cible + '/fichiers/' + bloc.mediaExtra))) {
												await fs.copy(path.normalize(cible + '/fichiers/' + bloc.mediaExtra), path.normalize(chemin + '/' + bloc.mediaExtra, { overwrite: true }))
											} else if (stockage === 's3' && bloc.hasOwnProperty('mediaExtra') && bloc.mediaExtra !== '' && await fs.pathExists(path.normalize(cible + '/fichiers/' + bloc.mediaExtra))) {
												const buffer = await fs.readFile(path.normalize(cible + '/fichiers/' + bloc.mediaExtra))
												await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: id + '/' + bloc.mediaExtra, Body: buffer, ACL: 'public-read' }))
											}
											if (bloc.hasOwnProperty('medias')) {
												const medias = JSON.parse(bloc.medias)
												for (let i = 0; i < medias.length; i++) {
													if (stockage === 'fs' && medias[i].hasOwnProperty('fichier') && medias[i].fichier !== '' && await fs.pathExists(path.normalize(cible + '/fichiers/' + medias[i].fichier))) {
														await fs.copy(path.normalize(cible + '/fichiers/' + medias[i].fichier), path.normalize(chemin + '/' + medias[i].fichier, { overwrite: true }))
													} else if (stockage === 's3' && medias[i].hasOwnProperty('fichier') && medias[i].fichier !== '' && await fs.pathExists(path.normalize(cible + '/fichiers/' + medias[i].fichier))) {
														const buffer = await fs.readFile(path.normalize(cible + '/fichiers/' + medias[i].fichier))
														await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: id + '/' + medias[i].fichier, Body: buffer, ACL: 'public-read' }))
													}
												}
											}
											if (stockage === 'fs' && bloc.hasOwnProperty('vignette') && definirVignettePersonnalisee(bloc.vignette) === true && await fs.pathExists(path.normalize(cible + '/fichiers/' + path.basename(bloc.vignette)))) {
												await fs.copy(path.normalize(cible + '/fichiers/' + path.basename(bloc.vignette)), path.normalize(chemin + '/' + path.basename(bloc.vignette), { overwrite: true }))
											} else if (stockage === 's3' && bloc.hasOwnProperty('vignette') && definirVignettePersonnalisee(bloc.vignette) === true && await fs.pathExists(path.normalize(cible + '/fichiers/' + path.basename(bloc.vignette)))) {
												const buffer = await fs.readFile(path.normalize(cible + '/fichiers/' + path.basename(bloc.vignette)))
												await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: id + '/' + path.basename(bloc.vignette), Body: buffer, ACL: 'public-read' }))
											}
											resolve({ bloc: bloc.bloc, blocId: blocId })
										} else {
											resolve({ bloc: 0, blocId: 0 })
										}
									})
									donneesBlocs.push(donneesBloc)
								}
								Promise.all(donneesBlocs).then(async function (blocsCrees) {
									const slug = definirSlug(donnees.mur.titre)
									const date = dayjs().format()
									const code = Math.floor(100000 + Math.random() * 900000)
									let activiteId = 0
									if (parametres.activite === true) {
										activiteId = donnees.mur.activite
									}
									if (stockage === 'fs' && !donnees.mur.fond.includes('/img/') && donnees.mur.fond.substring(0, 1) !== '#' && donnees.mur.fond !== '' && await fs.pathExists(path.normalize(cible + '/fichiers/' + path.basename(donnees.mur.fond)))) {
										await fs.copy(path.normalize(cible + '/fichiers/' + path.basename(donnees.mur.fond)), path.normalize(chemin + '/' + path.basename(donnees.mur.fond), { overwrite: true }))
									} else if (stockage === 's3' && !donnees.mur.fond.includes('/img/') && donnees.mur.fond.substring(0, 1) !== '#' && donnees.mur.fond !== '' && await fs.pathExists(path.normalize(cible + '/fichiers/' + path.basename(donnees.mur.fond)))) {
										const buffer = await fs.readFile(path.normalize(cible + '/fichiers/' + path.basename(donnees.mur.fond)))
										await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: id + '/' + path.basename(donnees.mur.fond), Body: buffer, ACL: 'public-read' }))
									}
									let epinglage = 'desactive'
									if (donnees.mur.hasOwnProperty('epinglage')) {
										epinglage = donnees.mur.epinglage
									}
									await db.HSET('murs:' + id, ['titre', donnees.mur.titre, 'identifiant', identifiant, 'fond', donnees.mur.fond, 'acces', donnees.mur.acces, 'motdepasseAdmin', '', 'code', code, 'contributions', donnees.mur.contributions, 'affichage', donnees.mur.affichage, 'registreActivite', donnees.mur.registreActivite, 'conversation', donnees.mur.conversation, 'listeUtilisateurs', donnees.mur.listeUtilisateurs, 'editionNom', donnees.mur.editionNom, 'fichiers', donnees.mur.fichiers, 'enregistrements', donnees.mur.enregistrements, 'liens', donnees.mur.liens, 'documents', donnees.mur.documents, 'commentaires', donnees.mur.commentaires, 'evaluations', donnees.mur.evaluations, 'verrouillage', donnees.mur.verrouillage, 'epinglage', epinglage, 'copieBloc', donnees.mur.copieBloc, 'ordre', donnees.mur.ordre, 'largeur', donnees.mur.largeur, 'date', date, 'colonnes', donnees.mur.colonnes, 'affichageColonnes', donnees.mur.affichageColonnes, 'bloc', donnees.mur.bloc, 'activite', activiteId])
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
												await db.ZADD('activite:' + id, [{ score: activite.id, value: JSON.stringify(activite) }])
											}
										}
									}
									await fs.remove(source)
									await fs.remove(cible)
									res.send(slug)
								})
							} else {
								let donneesMur = await db.HGETALL('murs:' + id)
								donneesMur = Object.assign({}, donneesMur)
								if (donneesMur === null) { res.send('erreur_import'); return false }
								const chemin = path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + id)
								if (stockage === 'fs') {
									await fs.emptyDir(chemin)
								}
								const donneesBlocs = []
								for (const [indexBloc, bloc] of donnees.blocs.entries()) {
									const donneesBloc = new Promise(async function (resolve) {
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
											if (definirVignettePersonnalisee(bloc.vignette) === true) {
												bloc.vignette = path.basename(bloc.vignette)
											}
											let motdepasse = ''
											if (bloc.hasOwnProperty('motdepasse')) {
												motdepasse = bloc.motdepasse
											}
											let epinglee = 'non'
											if (bloc.hasOwnProperty('epinglee')) {
												epinglee = bloc.epinglee
											}
											const blocId = 'bloc-id-' + (new Date()).getTime() + Math.random().toString(16).slice(10)
											await db
											.multi()
											.HSET('contenu-blocs:' + id + ':' + blocId, ['id', bloc.id, 'bloc', blocId, 'typeBloc', bloc.typeBloc, 'titre', bloc.titre, 'texte', bloc.texte, 'media', bloc.media, 'iframe', bloc.iframe, 'type', bloc.type, 'source', bloc.source, 'vignette', bloc.vignette, 'vignetteActivee', bloc.vignetteActivee, 'mediaExtra', bloc.mediaExtra, 'medias', bloc.medias, 'edition', bloc.edition, 'date', date, 'identifiant', bloc.identifiant, 'commentaires', commentaires, 'evaluations', evaluations, 'colonne', colonne, 'visibilite', bloc.visibilite, 'motdepasse', motdepasse, 'epinglee', epinglee, 'couleur', bloc.couleur])
											.ZADD('blocs:' + id, [{ score: indexBloc, value: blocId }])
											.exec()
											if (parametres.commentaires === true) {
												for (const commentaire of bloc.listeCommentaires) {
													if (commentaire.hasOwnProperty('id') && commentaire.hasOwnProperty('identifiant') && commentaire.hasOwnProperty('date') && commentaire.hasOwnProperty('texte')) {
														await db.ZADD('commentaires:' + blocId, [{ score: commentaire.id, value: JSON.stringify(commentaire) }])
													}
												}
											}
											if (parametres.evaluations === true) {
												for (const evaluation of bloc.listeEvaluations) {
													if (evaluation.hasOwnProperty('id') && evaluation.hasOwnProperty('identifiant') && evaluation.hasOwnProperty('date') && evaluation.hasOwnProperty('etoiles')) {
														await db.ZADD('evaluations:' + blocId, [{ score: evaluation.id, value: JSON.stringify(evaluation) }])
													}
												}
											}
											if (stockage === 'fs' && bloc.hasOwnProperty('media') && bloc.media !== '' && bloc.type !== 'embed' && bloc.type !== 'lien' && await fs.pathExists(path.normalize(cible + '/fichiers/' + bloc.media))) {
												await fs.copy(path.normalize(cible + '/fichiers/' + bloc.media), path.normalize(chemin + '/' + bloc.media, { overwrite: true }))
											} else if (stockage === 's3' && bloc.hasOwnProperty('media') && bloc.media !== '' && bloc.type !== 'embed' && bloc.type !== 'lien' && await fs.pathExists(path.normalize(cible + '/fichiers/' + bloc.media))) {
												const buffer = await fs.readFile(path.normalize(cible + '/fichiers/' + bloc.media))
												await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: id + '/' + bloc.media, Body: buffer, ACL: 'public-read' }))
											}
											if (stockage === 'fs' && bloc.hasOwnProperty('mediaExtra') && bloc.mediaExtra !== '' && await fs.pathExists(path.normalize(cible + '/fichiers/' + bloc.mediaExtra))) {
												await fs.copy(path.normalize(cible + '/fichiers/' + bloc.mediaExtra), path.normalize(chemin + '/' + bloc.mediaExtra, { overwrite: true }))
											} else if (stockage === 's3' && bloc.hasOwnProperty('mediaExtra') && bloc.mediaExtra !== '' && await fs.pathExists(path.normalize(cible + '/fichiers/' + bloc.mediaExtra))) {
												const buffer = await fs.readFile(path.normalize(cible + '/fichiers/' + bloc.mediaExtra))
												await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: id + '/' + bloc.mediaExtra, Body: buffer, ACL: 'public-read' }))
											}
											if (bloc.hasOwnProperty('medias')) {
												const medias = JSON.parse(bloc.medias)
												for (let i = 0; i < medias.length; i++) {
													if (stockage === 'fs' && medias[i].hasOwnProperty('fichier') && medias[i].fichier !== '' && await fs.pathExists(path.normalize(cible + '/fichiers/' + medias[i].fichier))) {
														await fs.copy(path.normalize(cible + '/fichiers/' + medias[i].fichier), path.normalize(chemin + '/' + medias[i].fichier, { overwrite: true }))
													} else if (stockage === 's3' && medias[i].hasOwnProperty('fichier') && medias[i].fichier !== '' && await fs.pathExists(path.normalize(cible + '/fichiers/' + medias[i].fichier))) {
														const buffer = await fs.readFile(path.normalize(cible + '/fichiers/' + medias[i].fichier))
														await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: id + '/' + medias[i].fichier, Body: buffer, ACL: 'public-read' }))
													}
												}
											}
											if (stockage === 'fs' && bloc.hasOwnProperty('vignette') && definirVignettePersonnalisee(bloc.vignette) === true && await fs.pathExists(path.normalize(cible + '/fichiers/' + path.basename(bloc.vignette)))) {
												await fs.copy(path.normalize(cible + '/fichiers/' + path.basename(bloc.vignette)), path.normalize(chemin + '/' + path.basename(bloc.vignette), { overwrite: true }))
											} else if (stockage === 's3' && bloc.hasOwnProperty('vignette') && definirVignettePersonnalisee(bloc.vignette) === true && await fs.pathExists(path.normalize(cible + '/fichiers/' + path.basename(bloc.vignette)))) {
												const buffer = await fs.readFile(path.normalize(cible + '/fichiers/' + path.basename(bloc.vignette)))
												await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: id + '/' + path.basename(bloc.vignette), Body: buffer, ACL: 'public-read' }))
											}
											resolve({ bloc: bloc.bloc, blocId: blocId })
										} else {
											resolve({ bloc: 0, blocId: 0 })
										}
									})
									donneesBlocs.push(donneesBloc)
								}
								Promise.all(donneesBlocs).then(async function (blocsCrees) {
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
									await db.HSET('murs:' + id, ['identifiant', identifiant, 'colonnes', JSON.stringify(colonnes), 'affichageColonnes', JSON.stringify(affichageColonnes), 'bloc', blocNum, 'activite', activiteId])
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
												await db.ZADD('activite:' + id, [{ score: activite.id, value: JSON.stringify(activite) }])
											}
										}
									}
									await fs.remove(source)
									await fs.remove(cible)
									res.send(slug)
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
				} else {
					await fs.remove(path.join(__dirname, '..', '/static/temp/' + req.file.filename))
					res.send('non_connecte')
				}
			})
		} else {
			res.send('non_connecte')
		}
	})

	app.post('/api/mettre-mur-corbeille', async function (req, res) {
		const identifiant = req.body.identifiant
		if (req.session.identifiant && req.session.identifiant === identifiant && req.session.statut === 'utilisateur' && req.session.hasOwnProperty('motdepasse') && req.session.motdepasse !== '') {
			const murId = req.body.murId
			if (await verifierAdminUtilisateur(murId, identifiant, req.session.motdepasse) === true) {
				await db
				.multi()
				.SADD('murs-supprimes:' + identifiant, murId.toString())
				.SREM('murs-crees:' + identifiant, murId.toString())
				.exec()
				res.send('mur_supprime')
			} else {
				res.send('non_autorise')
			}
		} else {
			res.send('non_connecte')
		}
	})

	app.post('/api/restaurer-mur', async function (req, res) {
		const identifiant = req.body.identifiant
		if (req.session.identifiant && req.session.identifiant === identifiant && req.session.statut === 'utilisateur' && req.session.hasOwnProperty('motdepasse') && req.session.motdepasse !== '') {
			const murId = req.body.murId
			if (await verifierAdminUtilisateur(murId, identifiant, req.session.motdepasse) === true) {
				await db
				.multi()
				.SREM('murs-supprimes:' + identifiant, murId.toString())
				.SADD('murs-crees:' + identifiant, murId.toString())
				.exec()
				res.send('mur_restaure')
			} else {
				res.send('non_autorise')
			}
		} else {
			res.send('non_connecte')
		}
	})

	app.post('/api/supprimer-mur', async function (req, res) {
		if (maintenance === true) {
			res.redirect('/maintenance')
			return false
		}
		const identifiant = req.body.identifiant
		const motdepasseAdmin = req.body.admin
		const motdepasseEnvAdmin = process.env.ADMIN_PASSWORD
		const mur = req.body.murId
		const type = req.body.type
		let admin = false
		if (motdepasseAdmin !== '' && motdepasseAdmin === motdepasseEnvAdmin) {
			admin = true
		}
		if ((req.session.identifiant && req.session.identifiant === identifiant && ((req.session.statut === 'utilisateur' && req.session.hasOwnProperty('motdepasse') && req.session.motdepasse !== '') || req.session.statut === 'auteur')) || admin) {
			let suppressionFichiers = true
			if (req.body.hasOwnProperty('suppressionFichiers')) {
				suppressionFichiers = req.body.suppressionFichiers
			}
			const resultat = await db.EXISTS('murs:' + mur)
			if (resultat === null) { res.send('erreur_suppression'); return false }
			if (resultat === 1) {
				let donneesMur = await db.HGETALL('murs:' + mur)
				donneesMur = Object.assign({}, donneesMur)
				if (donneesMur === null) { res.send('erreur_suppression'); return false }
				if (donneesMur.identifiant === identifiant) { // mur créé
					if (admin || await verifierAdmin(mur, donneesMur, req.session) === true) {
						const blocs = await db.ZRANGE('blocs:' + mur, 0, -1)
						if (blocs === null) { res.send('erreur_suppression'); return false }
						for (let i = 0; i < blocs.length; i++) {
							await db
							.multi()
							.UNLINK('commentaires:' + blocs[i])
							.UNLINK('evaluations:' + blocs[i])
							.UNLINK('contenu-blocs:' + mur + ':' + blocs[i])
							.exec()
						}
						await db
						.multi()
						.UNLINK('blocs:' + mur)
						.UNLINK('murs:' + mur)
						.UNLINK('activite:' + mur)
						.UNLINK('dates-murs:' + mur)
						.SREM('murs-crees:' + identifiant, mur.toString())
						.SREM('murs-supprimes:' + identifiant, mur.toString())
						.exec()
						const utilisateurs = await db.SMEMBERS('utilisateurs-murs:' + mur)
						if (utilisateurs === null) { res.send('erreur_suppression'); return false }
						for (let j = 0; j < utilisateurs.length; j++) {
							await db
							.multi()
							.SREM('murs-rejoints:' + utilisateurs[j], mur.toString())
							.SREM('murs-utilisateurs:' + utilisateurs[j], mur.toString())
							.SREM('murs-admins:' + utilisateurs[j], mur.toString())
							.SREM('murs-favoris:' + utilisateurs[j], mur.toString())
							.exec()
						}
						await db.UNLINK('utilisateurs-murs:' + mur)
						if (stockage === 'fs' && suppressionFichiers === true) {
							const chemin = path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + mur)
							await fs.remove(chemin)
						} else if (stockage === 's3' && suppressionFichiers === true) {
							const liste = await s3Client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: mur + '/' }))
							if (liste !== null && liste.hasOwnProperty('Contents') && liste.Contents instanceof Array) {
								for (let i = 0; i < liste.Contents.length; i++) {
									await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: liste.Contents[i].Key }))
								}
							}
						}
						res.send('mur_supprime')
					} else {
						res.send('non_autorise')
					}
				} else { // mur rejoint
					let donnees = await db.HGETALL('utilisateurs:' + identifiant)
					donnees = Object.assign({}, donnees)
					if (donnees === null) { res.send('erreur_suppression'); return false }
					if (donnees.hasOwnProperty('dossiers')) {
						const dossiers = JSON.parse(donnees.dossiers)
						dossiers.forEach(function (dossier, indexDossier) {
							if (dossier.murs.includes(mur)) {
								const indexMur = dossier.murs.indexOf(mur)
								dossiers[indexDossier].murs.splice(indexMur, 1)
							}
						})
						await db.HSET('utilisateurs:' + identifiant, 'dossiers', JSON.stringify(dossiers))
					}
					if (type === 'mur-rejoint') {
						await db.SREM('murs-rejoints:' + identifiant, mur.toString())
					}
					if (type === 'mur-admin') {
						await db.SREM('murs-rejoints:' + identifiant, mur.toString())
						await db.SREM('murs-admins:' + identifiant, mur.toString())
					}
					await db.SREM('murs-favoris:' + identifiant, mur.toString())
					// Suppression de l'utilisateur dans la liste des admins du mur
					if (type === 'mur-admin') {
						let donnees = await db.HGETALL('murs:' + mur)
						donnees = Object.assign({}, donnees)
						if (donnees === null) {
							res.send('mur_supprime')
						} else {
							let listeAdmins = []
							if (donnees.hasOwnProperty('admins')) {
								listeAdmins = JSON.parse(donnees.admins)
							}
							if (listeAdmins.includes(identifiant)) {
								const index = listeAdmins.indexOf(identifiant)
								listeAdmins.splice(index, 1)
							}
							await db.HSET('murs:' + mur, 'admins', JSON.stringify(listeAdmins))
							res.send('mur_supprime')
						}
					} else {
						res.send('mur_supprime')
					}
				}
			}
		} else {
			supprimerSession(req)
			res.send('non_connecte')
		}
	})

	app.post('/api/modifier-informations', async function (req, res) {
		const identifiant = req.body.identifiant
		if (req.session.identifiant && req.session.identifiant === identifiant && req.session.statut === 'utilisateur' && req.session.hasOwnProperty('motdepasse') && req.session.motdepasse !== '') {
			let donneesUtilisateur = await db.HGETALL('utilisateurs:' + identifiant)
			donneesUtilisateur = Object.assign({}, donneesUtilisateur)
			if (donneesUtilisateur === null || !donneesUtilisateur.hasOwnProperty('motdepasse')) { res.send('erreur'); return false }
			if (await bcrypt.compare(req.session.motdepasse, donneesUtilisateur.motdepasse)) {
				const nom = req.body.nom
				const email = req.body.email.toLowerCase()
				await db.HSET('utilisateurs:' + identifiant, ['nom', nom, 'email', email])
				req.session.nom = nom
				req.session.email = email
				res.send('utilisateur_modifie')
			} else {
				res.send('non_connecte')
			}
		} else {
			supprimerSession(req)
			res.send('non_connecte')
		}
	})

	app.post('/api/modifier-mot-de-passe', async function (req, res) {
		const identifiant = req.body.identifiant
		if (req.session.identifiant && req.session.identifiant === identifiant) {
			let donnees = await db.HGETALL('utilisateurs:' + identifiant)
			donnees = Object.assign({}, donnees)
			if (donnees === null) { res.send('erreur'); return false }
			const motdepasse = req.body.motdepasse
			const nouveaumotdepasse = req.body.nouveaumotdepasse
			if (motdepasse.trim() !== '' && nouveaumotdepasse.trim() !== '' && donnees.hasOwnProperty('motdepasse') && donnees.motdepasse.trim() !== '' && await bcrypt.compare(motdepasse, donnees.motdepasse)) {
				const hash = await bcrypt.hash(nouveaumotdepasse, 10)
				await db.HSET('utilisateurs:' + identifiant, 'motdepasse', hash)
				req.session.motdepasse = nouveaumotdepasse
				res.send('motdepasse_modifie')
			} else {
				res.send('motdepasse_incorrect')
			}
		} else {
			res.send('non_connecte')
		}
	})

	app.post('/api/verifier-mot-de-passe-admin', function (req, res) {
		const admin = req.body.admin
		if (admin !== '' && admin === process.env.ADMIN_PASSWORD) {
			res.send('acces_verifie')
		} else {
			res.send('acces_invalide')
		}
	})

	app.post('/api/modifier-mot-de-passe-admin', async function (req, res) {
		const admin = req.body.admin
		if (admin !== '' && admin === process.env.ADMIN_PASSWORD) {
			const identifiant = req.body.identifiant
			const email = req.body.email.toLowerCase()
			if (identifiant !== '') {
				const resultat = await db.EXISTS('utilisateurs:' + identifiant)
				if (resultat === null) { res.send('erreur'); return false }
				if (resultat === 1) {
					const hash = await bcrypt.hash(req.body.motdepasse, 10)
					await db.HSET('utilisateurs:' + identifiant, 'motdepasse', hash)
					res.send('motdepasse_modifie')
				} else {
					res.send('identifiant_non_valide')
				}
			} else if (email !== '') {
				const utilisateurs = await db.KEYS('utilisateurs:*')
				if (utilisateurs !== null) {
					const donneesUtilisateurs = []
					utilisateurs.forEach(function (utilisateur) {
						const donneesUtilisateur = new Promise(async function (resolve) {
							let donnees = await db.HGETALL('utilisateurs:' + utilisateur.substring(13))
							donnees = Object.assign({}, donnees)
							if (donnees === null) { resolve({}); return false }
							if (donnees.hasOwnProperty('email')) {
								resolve({ identifiant: utilisateur.substring(13), email: donnees.email.toLowerCase() })
							} else {
								resolve({})
							}
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
							await db.HSET('utilisateurs:' + utilisateurId, 'motdepasse', hash)
							res.send(utilisateurId)
						} else {
							res.send('email_non_valide')
						}
					})
				} else {
					res.send('email_non_valide')
				}
			}
		} else {
			res.send('non_autorise')
		}
	})

	app.post('/api/recuperer-donnees-mur-admin', async function (req, res) {
		const mur = req.body.murId
		const admin = req.body.admin
		if (admin !== '' && admin === process.env.ADMIN_PASSWORD) {
			const resultat = await db.EXISTS('murs:' + mur)
			if (resultat === null) { res.send('erreur'); return false }
			if (resultat === 1) {
				let donneesMur = await db.HGETALL('murs:' + mur)
				donneesMur = Object.assign({}, donneesMur)
				if (donneesMur === null) { res.send('erreur'); return false }
				res.json(donneesMur)
			} else {
				res.send('mur_inexistant')
			}
		} else {
			res.send('non_autorise')
		}
	})

	app.post('/api/recuperer-donnees-utilisateur-admin', async function (req, res) {
		const admin = req.body.admin
		const identifiant = req.body.identifiant
		if (admin !== '' && admin === process.env.ADMIN_PASSWORD) {
			const resultat = await db.EXISTS('utilisateurs:' + identifiant)
			if (resultat === null) { res.send('erreur'); return false }
			if (resultat === 1) {
				let donneesUtilisateur = await db.HGETALL('utilisateurs:' + identifiant)
				donneesUtilisateur = Object.assign({}, donneesUtilisateur)
				if (donneesUtilisateur === null) { res.send('erreur'); return false }
				res.json(donneesUtilisateur)
			} else {
				res.send('utilisateur_inexistant')
			}
		} else {
			res.send('non_autorise')
		}
	})

	app.post('/api/modifier-donnees-mur-admin', async function (req, res) {
		const mur = req.body.murId
		const champ = req.body.champ
		const valeur = req.body.valeur
		const admin = req.body.admin
		if (admin !== '' && admin === process.env.ADMIN_PASSWORD) {
			const resultat = await db.EXISTS('murs:' + mur)
			if (resultat === null) { res.send('erreur'); return false }
			if (resultat === 1) {
				if (champ === 'motdepasse') {
					const hash = await bcrypt.hash(valeur, 10)
					await db.HSET('murs:' + mur, champ, hash)
				} else {
					await db.HSET('murs:' + mur, champ, valeur)
				}
				res.send('donnees_modifiees')
			} else {
				res.send('mur_inexistant')
			}
		} else {
			res.send('non_autorise')
		}
	})

	app.post('/api/rattacher-mur', async function (req, res) {
		const mur = req.body.murId
		const identifiant = req.body.identifiant
		const admin = req.body.admin
		if (admin !== '' && admin === process.env.ADMIN_PASSWORD) {
			const resultat = await db.EXISTS('utilisateurs:' + identifiant)
			if (resultat === null) { res.send('erreur'); return false  }
			if (resultat === 1) {
				const reponse = await db.EXISTS('murs:' + mur)
				if (reponse === null) { res.send('erreur'); return false  }
				if (reponse === 1) {
					let donnees = await db.HGETALL('murs:' + mur)
					donnees = Object.assign({}, donnees)
					if (donnees === null) { res.send('erreur'); return false }
					if (donnees.hasOwnProperty('motdepasse')) {
						await db
						.multi()
						.SADD('murs-crees:' + identifiant, mur.toString())
						.SADD('utilisateurs-murs:' + mur, identifiant)
						.HSET('murs:' + mur, 'identifiant', identifiant)
						.HDEL('murs:' + mur, 'motdepasse')
						.SREM('murs-rejoints:' + identifiant, mur.toString())
						.SREM('murs-utilisateurs:' + identifiant, mur.toString())
						.exec()
						res.send('mur_transfere')
					} else {
						res.send('mur_cree_avec_compte')
					}
				} else {
					res.send('mur_inexistant')
				}
			} else {
				res.send('utilisateur_inexistant')
			}
		} else {
			res.send('non_autorise')
		}
	})

	app.post('/api/transferer-mur', async function (req, res) {
		const nouvelIdentifiant = req.body.nouvelIdentifiant
		const mur = req.body.murId
		const admin = req.body.admin
		if (admin !== '' && admin === process.env.ADMIN_PASSWORD) {
			const resultat = await db.EXISTS('utilisateurs:' + nouvelIdentifiant)
			if (resultat === null) { res.send('erreur'); return false  }
			if (resultat === 1) {
				const reponse = await db.EXISTS('murs:' + mur)
				if (reponse === null) { res.send('erreur'); return false  }
				if (reponse === 1) {
					let donnees = await db.HGETALL('murs:' + mur)
					donnees = Object.assign({}, donnees)
					if (donnees === null) { res.send('erreur'); return false }
					const identifiant = donnees.identifiant
					await db
					.multi()
					.SADD('murs-crees:' + nouvelIdentifiant, mur.toString())
					.SREM('murs-crees:' + identifiant, mur.toString())
					.SREM('murs-supprimes:' + identifiant, mur.toString())
					.SADD('utilisateurs-murs:' + mur, nouvelIdentifiant)
					.SREM('utilisateurs-murs:' + mur, identifiant)
					.HSET('murs:' + mur, 'identifiant', nouvelIdentifiant)
					.SREM('murs-admins:' + nouvelIdentifiant, mur.toString())
					.SREM('murs-rejoints:' + nouvelIdentifiant, mur.toString())
					.SREM('murs-utilisateurs:' + nouvelIdentifiant, mur.toString())
					.exec()
					res.send('mur_transfere')
				} else {
					res.send('mur_inexistant')
				}
			} else {
				res.send('utilisateur_inexistant')
			}
		} else {
			res.send('non_autorise')
		}
	})

	app.post('/api/transferer-compte', async function (req, res) {
		const identifiant = req.body.identifiant
		const nouvelIdentifiant = req.body.nouvelIdentifiant
		const admin = req.body.admin
		if (admin !== '' && admin === process.env.ADMIN_PASSWORD) {
			const reponse = await db.EXISTS('utilisateurs:' + identifiant)
			if (reponse === null) { res.send('erreur'); return false  }
			if (reponse === 1) {
				const resultat = await db.EXISTS('utilisateurs:' + nouvelIdentifiant)
				if (resultat === null) { res.send('erreur'); return false  }
				if (resultat === 1) {
					const murs = await db.SMEMBERS('murs-crees:' + identifiant)
					if (murs === null) { res.send('erreur'); return false }
					const donneesMurs = []
					for (const mur of murs) {
						const donneesMur = new Promise(async function (resolve) {
							const r = await db.EXISTS('murs:' + mur)
							if (r === null) { resolve('erreur'); return false  }
							if (r === 1) {
								await db
								.multi()
								.SADD('murs-crees:' + nouvelIdentifiant, mur.toString())
								.SREM('murs-crees:' + identifiant, mur.toString())
								.SREM('murs-supprimes:' + identifiant, mur.toString())
								.SADD('utilisateurs-murs:' + mur, nouvelIdentifiant)
								.SREM('utilisateurs-murs:' + mur, identifiant)
								.HSET('murs:' + mur, 'identifiant', nouvelIdentifiant)
								.SREM('murs-admins:' + nouvelIdentifiant, mur.toString())
								.SREM('murs-rejoints:' + nouvelIdentifiant, mur.toString())
								.SREM('murs-utilisateurs:' + nouvelIdentifiant, mur.toString())
								.exec()
								resolve('mur_transfere')
							} else {
								resolve('mur_inexistant')
							}
						})
						donneesMurs.push(donneesMur)
					}
					Promise.all(donneesMurs).then(function () {
						res.send('compte_transfere')
					})
				} else {
					res.send('utilisateur_inexistant')
				}
			} else {
				res.send('utilisateur_inexistant')
			}
		} else {
			res.send('non_autorise')
		}
	})

	app.post('/api/supprimer-compte', async function (req, res) {
		if (maintenance === true) {
			res.redirect('/maintenance')
			return false
		}
		const identifiant = req.body.identifiant
		const motdepasseAdmin = req.body.admin
		const motdepasseEnvAdmin = process.env.ADMIN_PASSWORD
		let admin = false
		if (motdepasseAdmin !== '' && motdepasseAdmin === motdepasseEnvAdmin) {
			admin = true
		}
		if ((req.session.identifiant && req.session.identifiant === identifiant && req.session.statut === 'utilisateur' && req.session.hasOwnProperty('motdepasse') && req.session.motdepasse !== '') || admin) {
			let donneesUtilisateur = await db.HGETALL('utilisateurs:' + identifiant)
			donneesUtilisateur = Object.assign({}, donneesUtilisateur)
			if (donneesUtilisateur === null || !donneesUtilisateur.hasOwnProperty('motdepasse')) { res.send('erreur'); return false }
			if (admin || await bcrypt.compare(req.session.motdepasse, donneesUtilisateur.motdepasse)) {
				const email = donneesUtilisateur.email.toLowerCase()
				const murs = await db.SMEMBERS('murs-crees:' + identifiant)
				if (murs === null) { res.send('erreur'); return false }
				const donneesMurs = []
				for (const mur of murs) {
					const donneesMur = new Promise(async function (resolve) {
						const resultat = await db.EXISTS('murs:' + mur)
						if (resultat === null) { resolve(); return false }
						if (resultat === 1) {
							const blocs = await db.ZRANGE('blocs:' + mur, 0, -1)
							if (blocs === null) { resolve(); return false }
							for (let i = 0; i < blocs.length; i++) {
								await db
								.multi()
								.UNLINK('commentaires:' + blocs[i])
								.UNLINK('evaluations:' + blocs[i])
								.UNLINK('contenu-blocs:' + mur + ':' + blocs[i])
								.exec()
							}
							await db
							.multi()
							.UNLINK('blocs:' + mur)
							.UNLINK('murs:' + mur)
							.UNLINK('activite:' + mur)
							.UNLINK('dates-murs:' + mur)
							.exec()
							const utilisateurs = await db.SMEMBERS('utilisateurs-murs:' + mur)
							if (utilisateurs === null) { resolve(); return false }
							for (let j = 0; j < utilisateurs.length; j++) {
								await db
								.multi()
								.SREM('murs-rejoints:' + utilisateurs[j], mur.toString())
								.SREM('murs-utilisateurs:' + utilisateurs[j], mur.toString())
								.SREM('murs-admins:' + utilisateurs[j], mur.toString())
								.SREM('murs-favoris:' + utilisateurs[j], mur.toString())
								.exec()
							}
							await db.UNLINK('utilisateurs-murs:' + mur)
							if (stockage === 'fs') {
								const chemin = path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + mur)
								await fs.remove(chemin)
							} else if (stockage === 's3') {
								const liste = await s3Client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: mur + '/' }))
								if (liste !== null && liste.hasOwnProperty('Contents') && liste.Contents instanceof Array) {
									for (let i = 0; i < liste.Contents.length; i++) {
										await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: liste.Contents[i].Key }))
									}
								}
							}
							resolve(mur)
						} else {
							resolve()
						}
					})
					donneesMurs.push(donneesMur)
				}
				Promise.all(donneesMurs).then(async function () {
					const murs = await db.SMEMBERS('murs-utilisateurs:' + identifiant)
					if (murs === null) { res.send('erreur'); return false }
					const donneesBlocs = []
					const donneesActivites = []
					const donneesCommentaires = []
					const donneesEvaluations = []
					for (const mur of murs) {
						const resultat = await db.EXISTS('murs:' + mur)
						if (resultat === 1) {
							const donneesBloc = new Promise(async function (resolve) {
								const blocs = await db.ZRANGE('blocs:' + mur, 0, -1)
								if (blocs === null) { resolve(); return false }
								for (let i = 0; i < blocs.length; i++) {
									let donnees = await db.HGETALL('contenu-blocs:' + mur + ':' + blocs[i])
									donnees = Object.assign({}, donnees)
									if (donnees === null) { resolve(); return false }
									if (donnees.identifiant === identifiant) {
										if (donnees.hasOwnProperty('media') && donnees.media !== '' && donnees.type !== 'embed' && donnees.type !== 'lien') {
											await supprimerFichier(mur, donnees.media)
										}
										if (donnees.hasOwnProperty('mediaExtra') && donnees.mediaExtra !== '') {
											await supprimerFichier(mur, donnees.mediaExtra)
										}
										if (donnees.hasOwnProperty('medias')) {
											const medias = JSON.parse(donnees.medias)
											for (let i = 0; i < medias.length; i++) {
												if (medias[i].hasOwnProperty('fichier')) {
													await supprimerFichier(mur, medias[i].fichier)
												}
											}
										}
										if (donnees.hasOwnProperty('vignette') && definirVignettePersonnalisee(donnees.vignette) === true) {
											await supprimerFichier(mur, path.basename(donnees.vignette))
										}
										await db
										.multi()
										.UNLINK('contenu-blocs:' + mur + ':' + blocs[i])
										.ZREM('blocs:' + mur, blocs[i])
										.UNLINK('commentaires:' + blocs[i])
										.UNLINK('evaluations:' + blocs[i])
										.exec()
										resolve(blocs[i])
									} else {
										resolve(blocs[i])
									}
								}
							})
							donneesBlocs.push(donneesBloc)
							const donneesActivite = new Promise(async function (resolve) {
								const entrees = await db.ZRANGE('activite:' + mur, 0, -1)
								if (entrees === null) { resolve(); return false }
								for (let i = 0; i < entrees.length; i++) {
									const entree = JSON.parse(entrees[i])
									if (entree.identifiant === identifiant) {
										await db.ZREMRANGEBYSCORE('activite:' + mur, entree.id, entree.id)
										resolve(entree.id)
									} else {
										resolve(entree.id)
									}
								}
							})
							donneesActivites.push(donneesActivite)
							const donneesCommentaire = new Promise(async function (resolve) {
								const blocs = await db.ZRANGE('blocs:' + mur, 0, -1)
								if (blocs === null) { resolve(); return false }
								for (let i = 0; i < blocs.length; i++) {
									const commentaires = await db.ZRANGE('commentaires:' + blocs[i], 0, -1)
									if (commentaires === null) { resolve(); return false }
									for (let j = 0; j < commentaires.length; j++) {
										const commentaire = JSON.parse(commentaires[j])
										if (commentaire.identifiant === identifiant) {
											await db.ZREMRANGEBYSCORE('commentaires:' + blocs[i], commentaire.id, commentaire.id)
											resolve(commentaire.id)
										} else {
											resolve(commentaire.id)
										}
									}
								}
							})
							donneesCommentaires.push(donneesCommentaire)
							const donneesEvaluation = new Promise(async function (resolve) {
								const blocs = await db.ZRANGE('blocs:' + mur, 0, -1)
								if (blocs === null) { resolve(); return false }
								for (let i = 0; i < blocs.length; i++) {
									const evaluations = await db.ZRANGE('evaluations:' + blocs[i], 0, -1)
									if (evaluations === null) { resolve(); return false }
									for (let j = 0; j < evaluations.length; j++) {
										const evaluation = JSON.parse(evaluations[j])
										if (evaluation.identifiant === identifiant) {
											await db.ZREMRANGEBYSCORE('evaluations:' + blocs[i], evaluation.id, evaluation.id)
											resolve(evaluation.id)
										} else {
											resolve(evaluation.id)
										}
									}
								}
							})
							donneesEvaluations.push(donneesEvaluation)
						}
					}
					Promise.all([donneesBlocs, donneesActivites, donneesCommentaires, donneesEvaluations]).then(async function () {
						await db
						.multi()
						.UNLINK('murs-crees:' + identifiant)
						.UNLINK('murs-supprimes:' + identifiant)
						.UNLINK('murs-rejoints:' + identifiant)
						.UNLINK('murs-favoris:' + identifiant)
						.UNLINK('murs-admins:' + identifiant)
						.UNLINK('murs-utilisateurs:' + identifiant)
						.UNLINK('utilisateurs:' + identifiant)
						.UNLINK('emails:' + email)
						.UNLINK('noms:' + identifiant)
						.exec()
						if (!admin) {
							supprimerSession(req)
							res.send('compte_supprime')
						} else {
							const sessions = await db.KEYS('sessions:*')
							if (sessions !== null) {
								const donneesSessions = []
								sessions.forEach(function (session) {
									const donneesSession = new Promise(async function (resolve) {
										const donnees = await db.GET('sessions:' + session.substring(9))
										if (donnees === null) { resolve({}); return false }
										donnees = JSON.parse(donnees)
										if (donnees.hasOwnProperty('identifiant')) {
											resolve({ session: session.substring(9), identifiant: donnees.identifiant })
										} else {
											resolve({})
										}
									})
									donneesSessions.push(donneesSession)
								})
								Promise.all(donneesSessions).then(async function (donnees) {
									let sessionId = ''
									donnees.forEach(function (item) {
										if (item.hasOwnProperty('identifiant') && item.identifiant === identifiant) {
											sessionId = item.session
										}
									})
									if (sessionId !== '') {
										await db.UNLINK('sessions:' + sessionId)
									}
									res.send('compte_supprime')
								})
							} else {
								res.send('erreur')
							}
						}
					})
				})
			} else {

			}
		} else {
			res.send('non_autorise')
		}
	})

	app.post('/api/verifier-identifiant', async function (req, res) {
		const identifiant = req.body.identifiant
		const resultat = await db.EXISTS('utilisateurs:' + identifiant)
		if (resultat === null) { res.send('erreur'); return false }
		if (resultat === 1) {
			res.send('identifiant_valide')
		} else {
			res.send('identifiant_non_valide')
		}
	})

	app.post('/api/verifier-mot-de-passe', async function (req, res) {
		const mur = req.body.mur
		let donnees = await db.HGETALL('murs:' + mur)
		donnees = Object.assign({}, donnees)
		let identifiant
		const motdepasse = req.body.motdepasse
		if (donnees === null) { req.json({ message: 'erreur' }); return false }
		const motdepasseCorrect = motdepasse.trim() !== '' && donnees.hasOwnProperty('motdepasse') && donnees.motdepasse.trim() !== '' && await bcrypt.compare(motdepasse, donnees.motdepasse)
		const motdepasseAdminCorrect = donnees.hasOwnProperty('motdepasseAdmin') && motdepasse.trim() !== '' && motdepasse === donnees.motdepasseAdmin
		if (motdepasseCorrect || motdepasseAdminCorrect) {
			if (motdepasseCorrect) {
				identifiant = req.body.identifiantMur
			} else {
				identifiant = req.body.identifiant
			}
			const acces = req.body.acces
			const resultat = await db.EXISTS('utilisateurs:' + identifiant)
			if (resultat === null) { req.json({ message: 'erreur' }); return false }
			if (resultat === 1) {
				let utilisateur = await db.HGETALL('utilisateurs:' + identifiant)
				utilisateur = Object.assign({}, utilisateur)
				if (utilisateur === null) { req.json({ message: 'erreur' }); return false }
				req.session.identifiant = identifiant
				req.session.motdepasse = ''
				req.session.nom = utilisateur.nom
				req.session.statut = 'auteur'
				req.session.langue = utilisateur.langue
				if (!req.session.hasOwnProperty('acces')) {
					req.session.acces = []
				}
				if (!req.session.hasOwnProperty('murs')) {
					req.session.murs = []
				}
				if (!req.session.murs.includes(parseInt(mur))) {
					req.session.murs.push(parseInt(mur))
				}
				req.session.cookie.expires = new Date(Date.now() + dureeSession)
				if (acces === true) {
					res.json({ message: 'motdepasse_correct', identifiant: identifiant, nom: utilisateur.nom, langue: utilisateur.langue })
				} else {
					const donneesMur = await recupererDonneesMurProtege(donnees, mur, identifiant)
					res.json({ message: 'motdepasse_correct', identifiant: identifiant, nom: utilisateur.nom, langue: utilisateur.langue, mur: donneesMur.mur, blocs: donneesMur.blocs, activite: donneesMur.activite.reverse() })
				}
			} else {
				req.session.identifiant = identifiant
				req.session.motdepasse = ''
				req.session.statut = 'auteur'
				if (!req.session.hasOwnProperty('nom')) {
					if (identifiant.length === 13 && identifiant.substring(0, 1) === 'u') {
						req.session.nom = identifiant.slice(0, 8).toUpperCase()
					} else {
						req.session.nom = identifiant.toUpperCase()
					}
				}
				if (!req.session.hasOwnProperty('langue')) {
					req.session.langue = 'fr'
				}
				if (!req.session.hasOwnProperty('acces')) {
					req.session.acces = []
				}
				if (!req.session.hasOwnProperty('murs')) {
					req.session.murs = []
				}
				if (!req.session.murs.includes(parseInt(mur))) {
					req.session.murs.push(parseInt(mur))
				}
				req.session.cookie.expires = new Date(Date.now() + dureeSession)
				if (acces === true) {
					res.json({ message: 'motdepasse_correct', identifiant: identifiant, nom: req.session.nom, langue: req.session.langue })
				} else {
					const donneesMur = await recupererDonneesMurProtege(donnees, mur, identifiant)
					res.json({ message: 'motdepasse_correct', identifiant: identifiant, nom: req.session.nom, langue: req.session.langue, mur: donneesMur.mur, blocs: donneesMur.blocs, activite: donneesMur.activite.reverse() })
				}
			}
		} else {
			res.json({ message: 'motdepasse_incorrect' })
		}
	})

	app.post('/api/verifier-code-acces', async function (req, res) {
		const mur = req.body.mur
		const identifiant = req.body.identifiant
		const code = req.body.code
		let donnees = await db.HGETALL('murs:' + mur)
		donnees = Object.assign({}, donnees)
		if (donnees === null || !donnees.hasOwnProperty('code')) { res.send('erreur'); return false }
		if (code === donnees.code) {
			const donneesMur = await recupererDonneesMurProtege(donnees, mur, identifiant)
			if (!req.session.hasOwnProperty('acces')) {
				req.session.acces = []
			}
			let murAcces = false
			req.session.acces.forEach(function (acces) {
				if (parseInt(acces.mur) === parseInt(mur)) {
					murAcces = true
				}
			})
			if (murAcces) {
				req.session.acces.forEach(function (acces, index) {
					if (parseInt(acces.mur) === parseInt(mur)) {
						req.session.acces[index].code = code
					}
				})
			} else {
				req.session.acces.push({ code: code, mur: parseInt(mur) })
			}
			res.send({ mur: donneesMur.mur, blocs: donneesMur.blocs, activite: donneesMur.activite.reverse() })
		} else {
			res.send('code_incorrect')
		}
	})

	app.post('/api/modifier-langue', async function (req, res) {
		const identifiant = req.body.identifiant
		const langue = req.body.langue
		if (req.session.identifiant && req.session.identifiant === identifiant) {
			await db.HSET('utilisateurs:' + identifiant, 'langue', langue)
			req.session.langue = langue
		} else {
			req.session.langue = langue
		}
		res.send('langue_modifiee')
	})

	app.post('/api/modifier-affichage', async function (req, res) {
		const identifiant = req.body.identifiant
		if (req.session.identifiant && req.session.identifiant === identifiant && req.session.statut === 'utilisateur' && req.session.hasOwnProperty('motdepasse') && req.session.motdepasse !== '') {
			let donneesUtilisateur = await db.HGETALL('utilisateurs:' + identifiant)
			donneesUtilisateur = Object.assign({}, donneesUtilisateur)
			if (donneesUtilisateur === null || !donneesUtilisateur.hasOwnProperty('motdepasse')) { res.send('erreur'); return false }
			if (await bcrypt.compare(req.session.motdepasse, donneesUtilisateur.motdepasse)) {
				const affichage = req.body.affichage
				await db.HSET('utilisateurs:' + identifiant, 'affichage', affichage)
				res.send('affichage_modifie')
			} else {
				res.send('non_connecte')
			}
		} else {
			supprimerSession(req)
			res.send('non_connecte')
		}
	})

	app.post('/api/modifier-classement', async function (req, res) {
		const identifiant = req.body.identifiant
		if (req.session.identifiant && req.session.identifiant === identifiant && req.session.statut === 'utilisateur' && req.session.hasOwnProperty('motdepasse') && req.session.motdepasse !== '') {
			let donneesUtilisateur = await db.HGETALL('utilisateurs:' + identifiant)
			donneesUtilisateur = Object.assign({}, donneesUtilisateur)
			if (donneesUtilisateur === null || !donneesUtilisateur.hasOwnProperty('motdepasse')) { res.send('erreur'); return false }
			if (await bcrypt.compare(req.session.motdepasse, donneesUtilisateur.motdepasse)) {
				const classement = req.body.classement
				await db.HSET('utilisateurs:' + identifiant, 'classement', classement)
				req.session.classement = classement
				res.send('classement_modifie')
			} else {
				res.send('non_connecte')
			}
		} else {
			supprimerSession(req)
			res.send('non_connecte')
		}
	})

	app.post('/api/ajouter-dossier', async function (req, res) {
		const identifiant = req.body.identifiant
		if (req.session.identifiant && req.session.identifiant === identifiant && req.session.statut === 'utilisateur' && req.session.hasOwnProperty('motdepasse') && req.session.motdepasse !== '') {
			let donneesUtilisateur = await db.HGETALL('utilisateurs:' + identifiant)
			donneesUtilisateur = Object.assign({}, donneesUtilisateur)
			if (donneesUtilisateur === null || !donneesUtilisateur.hasOwnProperty('motdepasse')) { res.send('erreur_ajout_dossier'); return false }
			if (await bcrypt.compare(req.session.motdepasse, donneesUtilisateur.motdepasse)) {
				const nom = req.body.dossier
				let dossiers = []
				if (donneesUtilisateur.hasOwnProperty('dossiers')) {
					dossiers = JSON.parse(donneesUtilisateur.dossiers)
				}
				const id = Math.random().toString(36).substring(2)
				dossiers.push({ id: id, nom: nom, murs: [] })
				await db.HSET('utilisateurs:' + identifiant, 'dossiers', JSON.stringify(dossiers))
				res.json({ id: id, nom: nom, murs: [] })
			} else {
				res.send('non_connecte')
			}
		} else {
			supprimerSession(req)
			res.send('non_connecte')
		}
	})

	app.post('/api/modifier-dossier', async function (req, res) {
		const identifiant = req.body.identifiant
		if (req.session.identifiant && req.session.identifiant === identifiant && req.session.statut === 'utilisateur' && req.session.hasOwnProperty('motdepasse') && req.session.motdepasse !== '') {
			let donneesUtilisateur = await db.HGETALL('utilisateurs:' + identifiant)
			donneesUtilisateur = Object.assign({}, donneesUtilisateur)
			if (donneesUtilisateur === null || !donneesUtilisateur.hasOwnProperty('motdepasse')) { res.send('erreur_modification_dossier'); return false }
			if (await bcrypt.compare(req.session.motdepasse, donneesUtilisateur.motdepasse)) {
				const nom = req.body.dossier
				const dossierId = req.body.dossierId
				const dossiers = JSON.parse(donneesUtilisateur.dossiers)
				dossiers.forEach(function (dossier, index) {
					if (dossier.id === dossierId) {
						dossiers[index].nom = nom
					}
				})
				await db.HSET('utilisateurs:' + identifiant, 'dossiers', JSON.stringify(dossiers))
				res.send('dossier_modifie')
			} else {
				res.send('non_connecte')
			}
		} else {
			supprimerSession(req)
			res.send('non_connecte')
		}
	})

	app.post('/api/supprimer-dossier', async function (req, res) {
		const identifiant = req.body.identifiant
		if (req.session.identifiant && req.session.identifiant === identifiant && req.session.statut === 'utilisateur' && req.session.hasOwnProperty('motdepasse') && req.session.motdepasse !== '') {
			let donneesUtilisateur = await db.HGETALL('utilisateurs:' + identifiant)
			donneesUtilisateur = Object.assign({}, donneesUtilisateur)
			if (donneesUtilisateur === null || !donneesUtilisateur.hasOwnProperty('motdepasse')) { res.send('erreur_suppression_dossier'); return false }
			if (await bcrypt.compare(req.session.motdepasse, donneesUtilisateur.motdepasse)) {
				const dossierId = req.body.dossierId
				const dossiers = JSON.parse(donneesUtilisateur.dossiers)
				dossiers.forEach(function (dossier, index) {
					if (dossier.id === dossierId) {
						dossiers.splice(index, 1)
					}
				})
				await db.HSET('utilisateurs:' + identifiant, 'dossiers', JSON.stringify(dossiers))
				res.send('dossier_supprime')
			} else {
				res.send('non_connecte')
			}
		} else {
			supprimerSession(req)
			res.send('non_connecte')
		}
	})

	app.post('/api/televerser-fichier', function (req, res) {
		const identifiant = req.session.identifiant
		if (!identifiant) {
			res.send('non_connecte')
		} else if (stockage === 's3') {
			const buffers = []
			let nom
			let mimetype
			const busboy = Busboy({ headers: req.headers })
			busboy.on('file', function (champ, fichier, meta) {
				mimetype = meta.mimeType
				nom = definirNomFichier(meta.filename)
				fichier.on('data', function (donnees) {
					buffers.push(donnees)
				})
			})
			busboy.on('finish', async function () {
				const bufferFichier = Buffer.concat(buffers)
				if (bufferFichier !== null && nom !== null && mimetype !== null) {
					if (mimetype.split('/')[0] === 'image') {
						const extension = path.parse(nom).ext
						if (extension.toLowerCase() === '.jpg' || extension.toLowerCase() === '.jpeg') {
							try {
								const buffer = await sharp(bufferFichier, { failOnError: false }).withMetadata().rotate().jpeg().resize(1200, 1200, {
									fit: sharp.fit.inside,
									withoutEnlargement: true
								}).toBuffer()
								if (buffer !== null) {
									await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: 'temp/' + nom, Body: buffer, ACL: 'public-read' }))
									res.json({ fichier: nom, mimetype: mimetype })
								} else {
									res.send('erreur_televersement')
								}
							} catch (e) {
								res.send('erreur_televersement')
							}
						} else if (extension.toLowerCase() !== '.gif') {
							try {
								const buffer = await sharp(bufferFichier, { failOnError: false }).withMetadata().resize(1200, 1200, {
									fit: sharp.fit.inside,
									withoutEnlargement: true
								}).toBuffer()
								if (buffer !== null) {
									await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: 'temp/' + nom, Body: buffer, ACL: 'public-read' }))
									res.json({ fichier: nom, mimetype: mimetype })
								} else {
									res.send('erreur_televersement')
								}
							} catch (e) {
								res.send('erreur_televersement')
							}
						} else {
							await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: 'temp/' + nom, Body: bufferFichier, ACL: 'public-read' }))
							res.json({ fichier: nom, mimetype: mimetype })
						}
					} else if (mimetype === 'application/pdf') {
						gm(bufferFichier).setFormat('jpg').resize(450).quality(80).toBuffer(async function (erreur, buffer) {
							if (erreur) {
								await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: 'temp/' + path.parse(nom).name + '.pdf', Body: bufferFichier, ACL: 'public-read' }))
								res.json({ fichier: nom, mimetype: 'pdf', vignetteGeneree: false })
							} else {
								await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: 'temp/' + path.parse(nom).name + '.pdf', Body: bufferFichier, ACL: 'public-read' }))
								await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: 'temp/' + path.parse(nom).name + '.jpg', Body: buffer, ACL: 'public-read' }))
								res.json({ fichier: nom, mimetype: 'pdf', vignetteGeneree: true })
							}
						})
					} else if (mimetype === 'application/vnd.oasis.opendocument.presentation' || mimetype === 'application/vnd.oasis.opendocument.text' || mimetype === 'application/vnd.oasis.opendocument.spreadsheet') {
						mimetype = 'document'
						let pdfBuffer
						try {
							pdfBuffer = await libre.convertAsync(bufferFichier, '.pdf', undefined)
						} catch (err) {
							pdfBuffer = 'erreur'
						}
						if (pdfBuffer && pdfBuffer !== 'erreur') {
							gm(pdfBuffer).setFormat('jpg').resize(450).quality(80).toBuffer(async function (erreur, buffer) {
								if (erreur) {
									await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: 'temp/' + nom, Body: bufferFichier, ACL: 'public-read' }))
									res.json({ fichier: nom, mimetype: mimetype, vignetteGeneree: false })
								} else {
									await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: 'temp/' + nom, Body: bufferFichier, ACL: 'public-read' }))
									await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: 'temp/' + path.parse(nom).name + '.jpg', Body: buffer, ACL: 'public-read' }))
									res.json({ fichier: nom, mimetype: mimetype, vignetteGeneree: true })
								}
							})
						} else {
							await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: 'temp/' + nom, Body: bufferFichier, ACL: 'public-read' }))
							res.json({ fichier: nom, mimetype: mimetype, vignetteGeneree: false })
						}
					} else if (mimetype === 'application/msword' || mimetype === 'application/vnd.ms-powerpoint' || mimetype === 'application/vnd.ms-excel' || mimetype.includes('officedocument') === true) {
						mimetype = 'office'
						let pdfBuffer
						try {
							pdfBuffer = await libre.convertAsync(bufferFichier, '.pdf', undefined)
						} catch (err) {
							pdfBuffer = 'erreur'
						}
						if (pdfBuffer && pdfBuffer !== 'erreur') {
							gm(pdfBuffer).setFormat('jpg').resize(450).quality(80).toBuffer(async function (erreur, buffer) {
								if (erreur) {
									await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: 'temp/' + nom, Body: bufferFichier, ACL: 'public-read' }))
									res.json({ fichier: nom, mimetype: mimetype, vignetteGeneree: false })
								} else {
									await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: 'temp/' + nom, Body: bufferFichier, ACL: 'public-read' }))
									await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: 'temp/' + path.parse(nom).name + '.jpg', Body: buffer, ACL: 'public-read' }))
									res.json({ fichier: nom, mimetype: mimetype, vignetteGeneree: true })
								}
							})
						} else {
							await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: 'temp/' + nom, Body: bufferFichier, ACL: 'public-read' }))
							res.json({ fichier: nom, mimetype: mimetype, vignetteGeneree: false })
						}
					} else {
						await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: 'temp/' + nom, Body: bufferFichier, ACL: 'public-read' }))
						res.json({ fichier: nom, mimetype: mimetype })
					}
				} else {
					res.send('erreur_televersement')
				}
			})
			req.pipe(busboy)
		} else {
			televerserTemp(req, res, async function (err) {
				if (err === 'erreur_espace_disque') { res.send('erreur_espace_disque'); return false }
				else if (err) { res.send('erreur_televersement'); return false }
				const fichier = req.file
				if (fichier.hasOwnProperty('mimetype') && fichier.hasOwnProperty('filename')) {
					let mimetype = fichier.mimetype
					const chemin = path.join(__dirname, '..', '/static/temp/' + fichier.filename)
					const destination = path.join(__dirname, '..', '/static/temp/' + path.parse(fichier.filename).name + '.jpg')
					const destinationPDF = path.join(__dirname, '..', '/static/temp/' + path.parse(fichier.filename).name + '.pdf')
					if (mimetype.split('/')[0] === 'image') {
						const extension = path.parse(fichier.filename).ext
						if (extension.toLowerCase() === '.jpg' || extension.toLowerCase() === '.jpeg') {
							try {
								const buffer = await sharp(chemin, { failOnError: false }).withMetadata().rotate().jpeg().resize(1200, 1200, {
									fit: sharp.fit.inside,
									withoutEnlargement: true
								}).toBuffer()
								if (buffer !== null) {
									await fs.writeFile(chemin, buffer)
									res.json({ fichier: fichier.filename, mimetype: mimetype })
								} else {
									res.send('erreur_televersement')
								}
							} catch (e) {
								res.send('erreur_televersement')
							}
						} else if (extension.toLowerCase() !== '.gif') {
							try {
								const buffer = await sharp(chemin, { failOnError: false }).withMetadata().resize(1200, 1200, {
									fit: sharp.fit.inside,
									withoutEnlargement: true
								}).toBuffer()
								if (buffer !== null) {
									await fs.writeFile(chemin, buffer)
									res.json({ fichier: fichier.filename, mimetype: mimetype })
								} else {
									res.send('erreur_televersement')
								}
							} catch (e) {
								res.send('erreur_televersement')
							}
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
						let pdfBuffer
						try {
							pdfBuffer = await libre.convertAsync(docBuffer, '.pdf', undefined)
						} catch (err) {
							pdfBuffer = 'erreur'
						}
						if (pdfBuffer && pdfBuffer !== 'erreur') {
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
							res.json({ fichier: fichier.filename, mimetype: mimetype, vignetteGeneree: false })
						}
					} else if (mimetype === 'application/msword' || mimetype === 'application/vnd.ms-powerpoint' || mimetype === 'application/vnd.ms-excel' || mimetype.includes('officedocument') === true) {
						mimetype = 'office'
						const docBuffer = await fs.readFile(chemin)
						let pdfBuffer
						try {
							pdfBuffer = await libre.convertAsync(docBuffer, '.pdf', undefined)
						} catch (err) {
							pdfBuffer = 'erreur'
						}
						if (pdfBuffer && pdfBuffer !== 'erreur') {
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
		} else if (stockage === 's3') {
			const buffers = []
			let nom
			const formData = new Map()
			const busboy = Busboy({ headers: req.headers })
			busboy.on('field', function (champ, valeur) {
				formData.set(champ, valeur)
			})
			busboy.on('file', function (champ, fichier, meta) {
				nom = definirNomFichier(meta.filename)
				fichier.on('data', function (donnees) {
					buffers.push(donnees)
				})
			})
			busboy.on('finish', async function () {
				const bufferFichier = Buffer.concat(buffers)
				if (bufferFichier !== null && nom !== null) {
					const mur = formData.get('mur')
					await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: mur + '/' + nom, Body: bufferFichier, ACL: 'public-read' }))
					res.send(nom)
				} else {
					res.send('erreur_televersement')
				}
			})
			req.pipe(busboy)
		} else {
			televerser(req, res, function (err) {
				if (err === 'erreur_espace_disque') { res.send('erreur_espace_disque'); return false }
				else if (err) { res.send('erreur_televersement'); return false }
				const fichier = req.file
				res.send(fichier.filename)
			})
		}
	})

	app.post('/api/televerser-vignette', function (req, res) {
		const identifiant = req.session.identifiant
		if (!identifiant) {
			res.send('non_connecte')
		} else if (stockage === 's3') {
			const buffers = []
			let nom
			const busboy = Busboy({ headers: req.headers })
			busboy.on('file', function (champ, fichier, meta) {
				nom = definirNomFichier(meta.filename)
				fichier.on('data', function (donnees) {
					buffers.push(donnees)
				})
			})
			busboy.on('finish', async function () {
				const bufferFichier = Buffer.concat(buffers)
				if (bufferFichier !== null && nom !== null) {
					const extension = path.parse(nom).ext
					if (extension.toLowerCase() === '.jpg' || extension.toLowerCase() === '.jpeg') {
						try {
							const buffer = await sharp(bufferFichier, { failOnError: false }).withMetadata().rotate().jpeg().resize(400, 400, {
								fit: sharp.fit.inside,
								withoutEnlargement: true
							}).toBuffer()
							if (buffer !== null) {
								await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: 'temp/' + nom, Body: buffer, ACL: 'public-read' }))
								res.send(nom)
							} else {
								res.send('erreur_televersement')
							}
						} catch (e) {
							res.send('erreur_televersement')
						}
					} else {
						try {
							const buffer = await sharp(bufferFichier, { failOnError: false }).withMetadata().resize(400, 400, {
								fit: sharp.fit.inside,
								withoutEnlargement: true
							}).toBuffer()
							if (buffer !== null) {
								await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: 'temp/' + nom, Body: buffer, ACL: 'public-read' }))
								res.send(nom)
							} else {
								res.send('erreur_televersement')
							}
						} catch (e) {
							res.send('erreur_televersement')
						}
					}
				} else {
					res.send('erreur_televersement')
				}
			})
			req.pipe(busboy)
		} else {
			televerserTemp(req, res, async function (err) {
				if (err === 'erreur_espace_disque') { res.send('erreur_espace_disque'); return false }
				else if (err) { res.send('erreur_televersement'); return false }
				const fichier = req.file
				const chemin = path.join(__dirname, '..', '/static/temp/' + fichier.filename)
				const extension = path.parse(fichier.filename).ext
				if (extension.toLowerCase() === '.jpg' || extension.toLowerCase() === '.jpeg') {
					try {
						const buffer = await sharp(chemin, { failOnError: false }).withMetadata().rotate().jpeg().resize(400, 400, {
							fit: sharp.fit.inside,
							withoutEnlargement: true
						}).toBuffer()
						if (buffer !== null) {
							await fs.writeFile(chemin, buffer)
							res.send(fichier.filename)
						} else {
							res.send('erreur_televersement')
						}
					} catch (e) {
						res.send('erreur_televersement')
					}
				} else {
					try {
						const buffer = await sharp(chemin, { failOnError: false }).withMetadata().resize(400, 400, {
							fit: sharp.fit.inside,
							withoutEnlargement: true
						}).toBuffer()
						if (buffer !== null) {
							await fs.writeFile(chemin, buffer)
							res.send(fichier.filename)
						} else {
							res.send('erreur_televersement')
						}
					} catch (e) {
						res.send('erreur_televersement')
					}
				}
			})
		}
	})

	app.post('/api/televerser-fond', function (req, res) {
		const identifiant = req.session.identifiant
		if (!identifiant) {
			res.send('non_connecte')
		} else if (stockage === 's3') {
			const buffers = []
			let nom
			const formData = new Map()
			const busboy = Busboy({ headers: req.headers })
			busboy.on('field', function (champ, valeur) {
				formData.set(champ, valeur)
			})
			busboy.on('file', async function (champ, fichier, meta) {
				nom = definirNomFichier(meta.filename)
				fichier.on('data', function (donnees) {
					buffers.push(donnees)
				})
			})
			busboy.on('finish', async function () {
				const bufferFichier = Buffer.concat(buffers)
				if (bufferFichier !== null && nom !== null) {
					const mur = formData.get('mur')
					const extension = path.parse(nom).ext
					if (extension.toLowerCase() === '.jpg' || extension.toLowerCase() === '.jpeg') {
						try {
							const buffer = await sharp(bufferFichier, { failOnError: false }).withMetadata().rotate().jpeg().resize(1200, 1200, {
								fit: sharp.fit.inside,
								withoutEnlargement: true
							}).toBuffer()
							if (buffer !== null) {
								await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: mur + '/' + nom, Body: buffer, ACL: 'public-read' }))
								res.send(nom)
							} else {
								res.send('erreur_televersement')
							}
						} catch (e) {
							res.send('erreur_televersement')
						}
					} else {
						try {
							const buffer = await sharp(bufferFichier, { failOnError: false }).withMetadata().resize(1200, 1200, {
								fit: sharp.fit.inside,
								withoutEnlargement: true
							}).toBuffer()
							if (buffer !== null) {
								await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: mur + '/' + nom, Body: buffer, ACL: 'public-read' }))
								res.send(nom)
							} else {
								res.send('erreur_televersement')
							}
						} catch (e) {
							res.send('erreur_televersement')
						}
					}
				} else {
					res.send('erreur_televersement')
				}
			})
			req.pipe(busboy)	
		} else {
			televerser(req, res, async function (err) {
				if (err === 'erreur_espace_disque') { res.send('erreur_espace_disque'); return false }
				else if (err) { res.send('erreur_televersement'); return false }
				const fichier = req.file
				const mur = req.body.mur
				const chemin = path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + mur + '/' + fichier.filename)
				const extension = path.parse(fichier.filename).ext
				if (extension.toLowerCase() === '.jpg' || extension.toLowerCase() === '.jpeg') {
					try {
						const buffer = await sharp(chemin, { failOnError: false }).withMetadata().rotate().jpeg().resize(1200, 1200, {
							fit: sharp.fit.inside,
							withoutEnlargement: true
						}).toBuffer()
						if (buffer !== null) {
							await fs.writeFile(chemin, buffer)
							res.send(fichier.filename)
						} else {
							res.send('erreur_televersement')
						}
					} catch (e) {
						res.send('erreur_televersement')
					}
				} else {
					try {
						const buffer = await sharp(chemin, { failOnError: false }).withMetadata().resize(1200, 1200, {
							fit: sharp.fit.inside,
							withoutEnlargement: true
						}).toBuffer()
						if (buffer !== null) {
							await fs.writeFile(chemin, buffer)
							res.send(fichier.filename)
						} else {
							res.send('erreur_televersement')
						}
					} catch (e) {
						res.send('erreur_televersement')
					}
				}
			})
		}
	})

	app.post('/api/recuperer-icone', async function (req, res) {
		const identifiant = req.session.identifiant
		if (!identifiant) {
			res.send('erreur')
		} else {
			let favicon = ''
			const domaine = req.body.domaine
			const protocole = req.body.protocole
			axios.get(protocole + '//' + domaine, { 
				responseType: 'document'
			}).then(function (reponse) {
				if (reponse && reponse.hasOwnProperty('data')) {
					const $ = cheerio.load(reponse.data)
					const recupererTaille = function (el) {
						return (el.attribs.sizes && parseInt(el.attribs.sizes, 10)) || 0
					}
					let favicons = [
						...$('meta[property="og:image"]')
					]
					if (favicons.length > 0 && favicons[0].hasOwnProperty('attribs')) {
						favicon = favicons[0].attribs.content
					} else {
						favicons = [
							...$('link[rel="shortcut icon"], link[rel="icon"], link[rel="apple-touch-icon"]')
						].sort((a, b) => {
							return recupererTaille(b) - recupererTaille(a)
						})
						if (favicons.length > 0 && favicons[0].hasOwnProperty('attribs')) {
							favicon = favicons[0].attribs.href
						}
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
				} else {
					res.send(favicon)
				}
			}).catch(function () {
				res.send('erreur')
			})
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
				const resultat = await db.EXISTS('mur')
				if (resultat === null) { res.send('erreur'); return false }
				if (resultat === 1) {
					const reponse = await db.GET('mur')
					if (reponse === null) { res.send('erreur'); return false }
					const id = parseInt(reponse) + 1
					creerMurSansCompte(req, res, id, token, slug, titre, hash, date, identifiant, nom, langue, 'api')
				} else {
					creerMurSansCompte(req, res, 1, token, slug, titre, hash, date, identifiant, nom, langue, 'api')
				}
			} else if (reponse.data === 'token_autorise' && req.body.action && req.body.action === 'modifier-titre') {
				const mur = req.body.id
				const titre = req.body.titre
				const resultat = await db.EXISTS('murs:' + mur)
				if (resultat === null) { res.send('erreur'); return false }
				if (resultat === 1) {
					await db.HSET('murs:' + mur, 'titre', titre)
					const slug = definirSlug(titre)
					res.send(slug)
				} else {
					res.send('contenu_inexistant')
				}
			} else if (reponse.data === 'token_autorise' && req.body.action && req.body.action === 'modifier') {
				const mur = req.body.id
				const titre = req.body.titre
				const identifiant = req.body.identifiant
				const ancienmotdepasse = req.body.ancienmotdepasse
				const resultat = await db.EXISTS('murs:' + mur)
				if (resultat === null) { res.send('erreur'); return false }
				if (resultat === 1) {
					let donneesMur = await db.HGETALL('murs:' + mur)
					donneesMur = Object.assign({}, donneesMur)
					if (donneesMur === null) { res.send('erreur'); return false }
					if (ancienmotdepasse.trim() !== '' && donneesMur.hasOwnProperty('motdepasse') && donneesMur.motdepasse.trim() !== '' && donneesMur.identifiant === identifiant && await bcrypt.compare(ancienmotdepasse, donneesMur.motdepasse)) {
						const motdepasse = req.body.motdepasse
						const hash = await bcrypt.hash(motdepasse, 10)
						await db.HSET('murs:' + mur, ['titre', titre, 'motdepasse', hash])
						const slug = definirSlug(titre)
						res.send(slug)
					} else {
						res.send('non_autorise')
					}
				} else {
					res.send('contenu_inexistant')
				}
			} else if (reponse.data === 'token_autorise' && req.body.action && req.body.action === 'ajouter') {
				const identifiant = req.body.identifiant
				const mur = req.body.id
				const token = req.body.tokenContenu
				const motdepasse = req.body.motdepasse
				const nom = req.body.nomUtilisateur
				const resultat = await db.EXISTS('murs:' + mur)
				if (resultat === null) { res.send('erreur'); return false }
				if (resultat === 1) {
					let donneesMur = await db.HGETALL('murs:' + mur)
					donneesMur = Object.assign({}, donneesMur)
					if (donneesMur === null) { res.send('erreur'); return false }
					if (motdepasse.trim() !== '' && donneesMur.hasOwnProperty('motdepasse') && donneesMur.motdepasse.trim() !== '' && await bcrypt.compare(motdepasse, donneesMur.motdepasse) && token === donneesMur.token) {
						const date = dayjs().format()
						let langue = 'fr'
						if (req.session.hasOwnProperty('langue') && req.session.langue !== '' && req.session.langue !== undefined) {
							langue = req.session.langue
						}
						await db
						.multi()
						.HSET('utilisateurs:' + identifiant, ['id', identifiant, 'date', date, 'nom', nom, 'langue', langue])
						.HSET('murs:' + mur, ['identifiant', identifiant, 'digidrive', 1])
						.exec()
						res.json({ titre: donneesMur.titre, identifiant: identifiant })
					} else if (!donneesMur.hasOwnProperty('motdepasse') && token === donneesMur.token) {
						const reponse = await db.EXISTS('utilisateurs:' + donneesMur.identifiant)
						if (reponse === null) { res.send('erreur'); return false }
						if (reponse === 1) {
							let utilisateur = await db.HGETALL('utilisateurs:' + donneesMur.identifiant)
							utilisateur = Object.assign({}, utilisateur)
							if (utilisateur === null) { res.send('erreur'); return false }
							if (motdepasse.trim() !== '' && utilisateur.hasOwnProperty('motdepasse') && utilisateur.motdepasse.trim() !== '' && await bcrypt.compare(motdepasse, utilisateur.motdepasse)) {
								await db.HSET('murs:' + mur, 'digidrive', 1)
								res.json({ titre: donneesMur.titre, identifiant: donneesMur.identifiant })
							} else {
								res.send('non_autorise')
							}
						} else {
							res.send('erreur')
						}
					} else {
						res.send('non_autorise')
					}
				} else {
					res.send('contenu_inexistant')
				}
			} else if (reponse.data === 'token_autorise' && req.body.action && req.body.action === 'dupliquer') {
				const identifiant = req.body.identifiant
				const motdepasse = req.body.motdepasse
				const mur = req.body.id
				const num = await db.GET('mur')
				if (num === null) { res.send('erreur'); return false }
				const id = parseInt(num) + 1
				const dossier = path.join(__dirname, '..', '/static' + definirCheminFichiers())
				checkDiskSpace(dossier).then(async function (diskSpace) {
					const espace = Math.round((diskSpace.free / diskSpace.size) * 100)
					if (stockage === 'fs' && espace < minimumEspaceDisque) {
						res.send('erreur')
					} else {
						const resultat = await db.EXISTS('murs:' + mur)
						if (resultat === null) { res.send('erreur'); return false }
						if (resultat === 1) {
							let donnees = await db.HGETALL('murs:' + mur)
							donnees = Object.assign({}, donnees)
							if (donnees === null || !donnees.hasOwnProperty('identifiant')) { res.send('erreur'); return false }
							let autorisation = false
							let avecCompte = false
							const proprietaire = donnees.identifiant
							if (proprietaire === identifiant && motdepasse.trim() !== '' && donnees.hasOwnProperty('motdepasse') && donnees.motdepasse.trim() !== '' && await bcrypt.compare(motdepasse, donnees.motdepasse)) {
								autorisation = true
							} else if (!donnees.hasOwnProperty('motdepasse') && proprietaire === identifiant) {
								const resultat = await db.EXISTS('utilisateurs:' + identifiant)
								if (resultat === null) { res.send('erreur'); return false }
								if (resultat === 1) {
									let utilisateur = await db.HGETALL('utilisateurs:' + identifiant)
									utilisateur = Object.assign({}, utilisateur)
									if (utilisateur === null) { res.send('erreur'); return false }
									if (motdepasse.trim() !== '' && utilisateur.hasOwnProperty('motdepasse') && utilisateur.motdepasse.trim() !== '' && await bcrypt.compare(motdepasse, utilisateur.motdepasse)) {
										autorisation = true
										avecCompte = true
									}
								}
							}
							if (autorisation === true) {
								const donneesBlocs = []
								const blocs = await db.ZRANGE('blocs:' + mur, 0, -1)
								if (blocs === null) { res.send('erreur'); return false }
								for (const [indexBloc, bloc] of blocs.entries()) {
									const donneesBloc = new Promise(async function (resolve) {
										let infos = await db.HGETALL('contenu-blocs:' + mur + ':' + bloc)
										infos = Object.assign({}, infos)
										if (infos === null) { resolve({}); return false }
										const date = dayjs().format()
										if (infos.hasOwnProperty('vignette') && definirVignettePersonnalisee(infos.vignette) === true) {
											infos.vignette = path.basename(infos.vignette)
										}
										if (infos.hasOwnProperty('iframe') && infos.iframe !== '' && infos.iframe.includes(etherpad)) {
											const etherpadId = infos.iframe.replace(etherpad + '/p/', '')
											const destinationId = 'mur-' + id + '-' + Math.random().toString(16).slice(2)
											const url = etherpad + '/api/1.2.14/copyPad?apikey=' + etherpadApi + '&sourceID=' + etherpadId + '&destinationID=' + destinationId
											axios.get(url)
											infos.iframe = etherpad + '/p/' + destinationId
											infos.media = etherpad + '/p/' + destinationId
										}
										let motdepasse = ''
										if (infos.hasOwnProperty('motdepasse')) {
											motdepasse = infos.motdepasse
										}
										let epinglee = 'non'
										if (infos.hasOwnProperty('epinglee')) {
											epinglee = infos.epinglee
										}
										const blocId = 'bloc-id-' + (new Date()).getTime() + Math.random().toString(16).slice(10)
										await db
										.multi()
										.HSET('contenu-blocs:' + id + ':' + blocId, ['id', infos.id, 'bloc', blocId, 'typeBloc', infos.typeBloc, 'titre', infos.titre, 'texte', infos.texte, 'media', infos.media, 'iframe', infos.iframe, 'type', infos.type, 'source', infos.source, 'vignette', infos.vignette, 'vignetteActivee', infos.vignetteActivee, 'mediaExtra', infos.mediaExtra, 'medias', infos.medias, 'edition', infos.edition, 'date', date, 'identifiant', infos.identifiant, 'commentaires', 0, 'evaluations', 0, 'colonne', infos.colonne, 'visibilite', infos.visibilite, 'motdepasse', motdepasse, 'epinglee', epinglee, 'couleur', infos.couleur])
										.ZADD('blocs:' + id, [{ score: indexBloc, value: blocId }])
										.exec()
										resolve(blocId)
									})
									donneesBlocs.push(donneesBloc)
								}
								Promise.all(donneesBlocs).then(async function () {
									const token = Math.random().toString(16).slice(10)
									const slug = definirSlug(donnees.titre)
									const nouveaumotdepasse = req.body.nouveaumotdepasse
									const hash = await bcrypt.hash(nouveaumotdepasse, 10)
									const date = dayjs().format()
									const code = Math.floor(100000 + Math.random() * 900000)
									if (!donnees.fond.includes('/img/') && donnees.fond.substring(0, 1) !== '#' && donnees.fond !== '') {
										donnees.fond = path.basename(donnees.fond)
									}
									let epinglage = 'desactive'
									if (donnees.hasOwnProperty('epinglage')) {
										epinglage = donnees.epinglage
									}
									if (donnees.hasOwnProperty('code') && avecCompte === false) {
										await db
										.multi()
										.INCR('mur')
										.HSET('murs:' + id, ['id', id, 'token', token, 'titre', 'Copie de ' + donnees.titre, 'identifiant', identifiant, 'motdepasse', hash, 'fond', donnees.fond, 'acces', donnees.acces, 'motdepasseAdmin', donnees.motdepasseAdmin, 'code', code, 'contributions', donnees.contributions, 'affichage', donnees.affichage, 'registreActivite', donnees.registreActivite, 'conversation', donnees.conversation, 'listeUtilisateurs', donnees.listeUtilisateurs, 'editionNom', donnees.editionNom, 'fichiers', donnees.fichiers, 'enregistrements', donnees.enregistrements, 'liens', donnees.liens, 'documents', donnees.documents, 'commentaires', donnees.commentaires, 'evaluations', donnees.evaluations, 'verrouillage', donnees.verrouillage, 'epinglage', epinglage, 'copieBloc', donnees.copieBloc, 'ordre', donnees.ordre, 'largeur', donnees.largeur, 'date', date, 'colonnes', donnees.colonnes, 'affichageColonnes', donnees.affichageColonnes, 'bloc', donnees.bloc, 'activite', 0, 'admins', JSON.stringify([]), 'vues', 0, 'digidrive', 1])
										.SADD('murs-crees:' + identifiant, id.toString())
										.exec()
									} else if (donnees.hasOwnProperty('code') && avecCompte === true) {
										await db
										.multi()
										.INCR('mur')
										.HSET('murs:' + id, ['id', id, 'token', token, 'titre', 'Copie de ' + donnees.titre, 'identifiant', identifiant, 'fond', donnees.fond, 'acces', donnees.acces, 'motdepasseAdmin', donnees.motdepasseAdmin, 'code', code, 'contributions', donnees.contributions, 'affichage', donnees.affichage, 'registreActivite', donnees.registreActivite, 'conversation', donnees.conversation, 'listeUtilisateurs', donnees.listeUtilisateurs, 'editionNom', donnees.editionNom, 'fichiers', donnees.fichiers, 'enregistrements', donnees.enregistrements, 'liens', donnees.liens, 'documents', donnees.documents, 'commentaires', donnees.commentaires, 'evaluations', donnees.evaluations, 'verrouillage', donnees.verrouillage, 'epinglage', epinglage, 'copieBloc', donnees.copieBloc, 'ordre', donnees.ordre, 'largeur', donnees.largeur, 'date', date, 'colonnes', donnees.colonnes, 'affichageColonnes', donnees.affichageColonnes, 'bloc', donnees.bloc, 'activite', 0, 'admins', JSON.stringify([]), 'vues', 0, 'digidrive', 1])
										.SADD('murs-crees:' + identifiant, id.toString())
										.SADD('utilisateurs-murs:' + id, identifiant)
										.exec()
									} else if (!donnees.hasOwnProperty('code') && avecCompte === false) {
										await db
										.multi()
										.INCR('mur')
										.HSET('murs:' + id, ['id', id, 'token', token, 'titre', 'Copie de ' + donnees.titre, 'identifiant', identifiant, 'motdepasse', hash, 'fond', donnees.fond, 'acces', donnees.acces, 'motdepasseAdmin', donnees.motdepasseAdmin, 'contributions', donnees.contributions, 'affichage', donnees.affichage, 'registreActivite', donnees.registreActivite, 'conversation', donnees.conversation, 'listeUtilisateurs', donnees.listeUtilisateurs, 'editionNom', donnees.editionNom, 'fichiers', donnees.fichiers, 'enregistrements', donnees.enregistrements, 'liens', donnees.liens, 'documents', donnees.documents, 'commentaires', donnees.commentaires, 'evaluations', donnees.evaluations, 'verrouillage', donnees.verrouillage, 'epinglage', epinglage, 'copieBloc', donnees.copieBloc, 'ordre', donnees.ordre, 'largeur', donnees.largeur, 'date', date, 'colonnes', donnees.colonnes, 'affichageColonnes', donnees.affichageColonnes, 'bloc', donnees.bloc, 'activite', 0, 'admins', JSON.stringify([]), 'vues', 0, 'digidrive', 1])
										.SADD('murs-crees:' + identifiant, id.toString())
										.exec()
									} else if (!donnees.hasOwnProperty('code') && avecCompte === true) {
										await db
										.multi()
										.INCR('mur')
										.HSET('murs:' + id, ['id', id, 'token', token, 'titre', 'Copie de ' + donnees.titre, 'identifiant', identifiant, 'fond', donnees.fond, 'acces', donnees.acces, 'motdepasseAdmin', donnees.motdepasseAdmin, 'contributions', donnees.contributions, 'affichage', donnees.affichage, 'registreActivite', donnees.registreActivite, 'conversation', donnees.conversation, 'listeUtilisateurs', donnees.listeUtilisateurs, 'editionNom', donnees.editionNom, 'fichiers', donnees.fichiers, 'enregistrements', donnees.enregistrements, 'liens', donnees.liens, 'documents', donnees.documents, 'commentaires', donnees.commentaires, 'evaluations', donnees.evaluations, 'verrouillage', donnees.verrouillage, 'epinglage', epinglage, 'copieBloc', donnees.copieBloc, 'ordre', donnees.ordre, 'largeur', donnees.largeur, 'date', date, 'colonnes', donnees.colonnes, 'affichageColonnes', donnees.affichageColonnes, 'bloc', donnees.bloc, 'activite', 0, 'admins', JSON.stringify([]), 'vues', 0, 'digidrive', 1])
										.SADD('murs-crees:' + identifiant, id.toString())
										.SADD('utilisateurs-murs:' + id, identifiant)
										.exec()
									}
									if (stockage === 'fs' && await fs.pathExists(path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + mur))) {
										await fs.copy(path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + mur), path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + id))
									} else if (stockage === 's3') {
										const liste = await s3Client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: mur + '/' }))
										if (liste !== null && liste.hasOwnProperty('Contents') && liste.Contents instanceof Array) {
											for (let i = 0; i < liste.Contents.length; i++) {
												await s3Client.send(new CopyObjectCommand({ Bucket: bucket, Key: id + '/' + liste.Contents[i].Key.replace(mur + '/', ''), CopySource: '/' + bucket + '/' + liste.Contents[i].Key, ACL: 'public-read' }))
											}
										}
									}
									res.send(id + '/' + token + '/' + slug)
								})
							} else {
								res.send('non_autorise')
							}
						}
					}
				})
			} else if (reponse.data === 'token_autorise' && req.body.action && req.body.action === 'exporter') {
				const identifiant = req.body.identifiant
				const motdepasse = req.body.motdepasse
				const id = req.body.id
				const resultat = await db.EXISTS('murs:' + id)
				if (resultat === null) { res.send('erreur'); return false }
				if (resultat === 1) {
					let d = await db.HGETALL('murs:' + id)
					d = Object.assign({}, d)
					if (d === null) { res.send('erreur'); return false }
					const proprietaire = d.identifiant
					if (proprietaire === identifiant && motdepasse.trim() !== '' && d.hasOwnProperty('motdepasse') && d.motdepasse.trim() !== '' && await bcrypt.compare(motdepasse, d.motdepasse)) {
						exporterMur(req, res, id, 'erreur')
					} else if (!d.hasOwnProperty('motdepasse') && proprietaire === identifiant) {
						const resultat = await db.EXISTS('utilisateurs:' + identifiant)
						if (resultat === null) { res.send('erreur'); return false }
						if (resultat === 1) {
							let utilisateur = await db.HGETALL('utilisateurs:' + identifiant)
							utilisateur = Object.assign({}, utilisateur)
							if (utilisateur === null) { res.send('erreur'); return false }
							if (motdepasse.trim() !== '' && utilisateur.hasOwnProperty('motdepasse') && utilisateur.motdepasse.trim() !== '' && await bcrypt.compare(motdepasse, utilisateur.motdepasse)) {
								exporterMur(req, res, id, 'erreur')
							} else {
								res.send('non_autorise')
							}
						} else {
							res.send('erreur')
						}
					} else {
						res.send('non_autorise')
					}
				} else {
					res.send('contenu_inexistant')
				}
			} else if (reponse.data === 'token_autorise' && req.body.action && req.body.action === 'supprimer') {
				const identifiant = req.body.identifiant
				const mur = req.body.id
				const motdepasse = req.body.motdepasse
				const resultat = await db.EXISTS('murs:' + mur)
				if (resultat === null) { res.send('erreur'); return false }
				if (resultat === 1) {
					let donneesMur = await db.HGETALL('murs:' + mur)
					donneesMur = Object.assign({}, donneesMur)
					if (donneesMur === null) { res.send('erreur'); return false }
					if (motdepasse.trim() !== '' && donneesMur.hasOwnProperty('motdepasse') && donneesMur.motdepasse.trim() !== '' && donneesMur.identifiant === identifiant && await bcrypt.compare(motdepasse, donneesMur.motdepasse)) {
						const blocs = await db.ZRANGE('blocs:' + mur, 0, -1)
						if (blocs === null) { res.send('erreur'); return false }
						for (let i = 0; i < blocs.length; i++) {
							await db
							.multi()
							.UNLINK('commentaires:' + blocs[i])
							.UNLINK('evaluations:' + blocs[i])
							.UNLINK('contenu-blocs:' + mur + ':' + blocs[i])
							.exec()
						}
						await db
						.multi()
						.UNLINK('blocs:' + mur)
						.UNLINK('murs:' + mur)
						.UNLINK('activite:' + mur)
						.UNLINK('dates-murs:' + mur)
						.SREM('murs-crees:' + identifiant, mur.toString())
						.SREM('murs-supprimes:' + identifiant, mur.toString())
						.exec()
						const utilisateurs = await db.SMEMBERS('utilisateurs-murs:' + mur)
						if (utilisateurs === null) { res.send('erreur'); return false }
						for (let j = 0; j < utilisateurs.length; j++) {
							await db
							.multi()
							.SREM('murs-rejoints:' + utilisateurs[j], mur.toString())
							.SREM('murs-utilisateurs:' + utilisateurs[j], mur.toString())
							.SREM('murs-admins:' + utilisateurs[j], mur.toString())
							.SREM('murs-favoris:' + utilisateurs[j], mur.toString())
							.exec()
						}
						await db.UNLINK('utilisateurs-murs:' + mur)
						if (stockage === 'fs') {
							const chemin = path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + mur)
							await fs.remove(chemin)
						} else if (stockage === 's3') {
							const liste = await s3Client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: mur + '/' }))
							if (liste !== null && liste.hasOwnProperty('Contents') && liste.Contents instanceof Array) {
								for (let i = 0; i < liste.Contents.length; i++) {
									await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: liste.Contents[i].Key }))
								}
							}
						}
						res.send('contenu_supprime')
					} else if (!donneesMur.hasOwnProperty('motdepasse') && donneesMur.identifiant === identifiant) {
						const resultat = await db.EXISTS('utilisateurs:' + identifiant)
						if (resultat === null) { res.send('erreur'); return false }
						if (resultat === 1) {
							let utilisateur = await db.HGETALL('utilisateurs:' + identifiant)
							utilisateur = Object.assign({}, utilisateur)
							if (utilisateur === null) { res.send('erreur'); return false }
							if (motdepasse.trim() !== '' && utilisateur.hasOwnProperty('motdepasse') && utilisateur.motdepasse.trim() !== '' && await bcrypt.compare(motdepasse, utilisateur.motdepasse)) {
								const blocs = await db.ZRANGE('blocs:' + mur, 0, -1)
								if (blocs === null) { res.send('erreur'); return false }
								for (let i = 0; i < blocs.length; i++) {
									await db
									.multi()
									.UNLINK('commentaires:' + blocs[i])
									.UNLINK('evaluations:' + blocs[i])
									.UNLINK('contenu-blocs:' + mur + ':' + blocs[i])
									.exec()
								}
								await db
								.multi()
								.UNLINK('blocs:' + mur)
								.UNLINK('murs:' + mur)
								.UNLINK('activite:' + mur)
								.UNLINK('dates-murs:' + mur)
								.SREM('murs-crees:' + identifiant, mur.toString())
								.SREM('murs-supprimes:' + identifiant, mur.toString())
								.exec()
								const utilisateurs = await db.SMEMBERS('utilisateurs-murs:' + mur)
								if (utilisateurs === null) { res.send('erreur'); return false }
								for (let j = 0; j < utilisateurs.length; j++) {
									await db
									.multi()
									.SREM('murs-rejoints:' + utilisateurs[j], mur.toString())
									.SREM('murs-utilisateurs:' + utilisateurs[j], mur.toString())
									.SREM('murs-admins:' + utilisateurs[j], mur.toString())
									.SREM('murs-favoris:' + utilisateurs[j], mur.toString())
									.exec()
								}
								await db.UNLINK('utilisateurs-murs:' + mur)
								if (stockage === 'fs') {
									const chemin = path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + mur)
									await fs.remove(chemin)
								} else if (stockage === 's3') {
									const liste = await s3Client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: mur + '/' }))
									if (liste !== null && liste.hasOwnProperty('Contents') && liste.Contents instanceof Array) {
										for (let i = 0; i < liste.Contents.length; i++) {
											await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: liste.Contents[i].Key }))
										}
									}
								}
								res.send('contenu_supprime')
							} else {
								res.send('non_autorise')
							}
						} else {
							res.send('erreur')
						}
					} else {
						res.send('non_autorise')
					}
				} else {
					res.send('contenu_supprime')
				}
			} else {
				res.send('erreur')
			}
		}).catch(function () {
			res.send('erreur')
		})
	})

	app.post('/api/ladigitale/importer', function (req, res) {
		televerserTemp(req, res, async function (err) {
			if (err) { res.send('erreur'); return false }
			try {
				const tokenApi = req.body.token
				const domaine = req.headers.host
				const lien = req.body.lien
				const params = new URLSearchParams()
				params.append('token', tokenApi)
				params.append('domaine', domaine)
				axios.post(lien, params).then(async function (reponse) {
					if (reponse.data === 'non_autorise' || reponse.data === 'erreur') {
						res.send('erreur_token')
					} else if (reponse.data === 'token_autorise' && req.body.action && req.body.action === 'importer') {
						const identifiant = req.body.identifiant
						let nom = req.body.nomUtilisateur
						if (nom === '') {
							nom = identifiant.toUpperCase()
						}
						const titre = req.body.titre
						const motdepasse = req.body.motdepasse
						const hash = await bcrypt.hash(motdepasse, 10)
						let langue = 'fr'
						if (req.session.hasOwnProperty('langue') && req.session.langue !== '' && req.session.langue !== undefined) {
							langue = req.session.langue
						}
						const source = path.join(__dirname, '..', '/static/temp/' + req.file.filename)
						const cible = path.join(__dirname, '..', '/static/temp/archive-' + Math.floor((Math.random() * 100000) + 1))
						await extract(source, { dir: cible })
						const donnees = await fs.readJson(path.normalize(cible + '/donnees.json'))
						const parametres = JSON.parse(req.body.parametres)
						// Vérification des clés des données
						if (donnees.hasOwnProperty('mur') && donnees.hasOwnProperty('blocs') && donnees.hasOwnProperty('activite') && donnees.mur.hasOwnProperty('id') && donnees.mur.hasOwnProperty('token') && donnees.mur.hasOwnProperty('titre') && donnees.mur.hasOwnProperty('identifiant') && donnees.mur.hasOwnProperty('fond') && donnees.mur.hasOwnProperty('acces') && donnees.mur.hasOwnProperty('motdepasseAdmin') && donnees.mur.hasOwnProperty('contributions') && donnees.mur.hasOwnProperty('affichage') && donnees.mur.hasOwnProperty('registreActivite') && donnees.mur.hasOwnProperty('conversation') && donnees.mur.hasOwnProperty('listeUtilisateurs') && donnees.mur.hasOwnProperty('editionNom') && donnees.mur.hasOwnProperty('enregistrements') && donnees.mur.hasOwnProperty('ordre') && donnees.mur.hasOwnProperty('largeur') && donnees.mur.hasOwnProperty('affichageColonnes') && donnees.mur.hasOwnProperty('vues') && donnees.mur.hasOwnProperty('fichiers') && donnees.mur.hasOwnProperty('liens') && donnees.mur.hasOwnProperty('documents') && donnees.mur.hasOwnProperty('commentaires') && donnees.mur.hasOwnProperty('evaluations') && donnees.mur.hasOwnProperty('verrouillage') && donnees.mur.hasOwnProperty('copieBloc') && donnees.mur.hasOwnProperty('date') && donnees.mur.hasOwnProperty('colonnes') && donnees.mur.hasOwnProperty('bloc') && donnees.mur.hasOwnProperty('activite')) {
							const resultat = await db.GET('mur')
							if (resultat === null) { res.send('erreur'); return false }
							const id = parseInt(resultat) + 1
							const dossier = path.join(__dirname, '..', '/static' + definirCheminFichiers())
							checkDiskSpace(dossier).then(async function (diskSpace) {
								const espace = Math.round((diskSpace.free / diskSpace.size) * 100)
								if (stockage === 'fs' && espace < minimumEspaceDisque) {
									res.send('erreur')
								} else {
									const chemin = path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + id)
									const donneesBlocs = []
									if (stockage === 'fs') {
										await fs.mkdirp(chemin)
									}
									for (const [indexBloc, bloc] of donnees.blocs.entries()) {
										const donneesBloc = new Promise(async function (resolve) {
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
												if (definirVignettePersonnalisee(bloc.vignette) === true) {
													bloc.vignette = path.basename(bloc.vignette)
												}
												let motdepasse = ''
												if (bloc.hasOwnProperty('motdepasse')) {
													motdepasse = bloc.motdepasse
												}
												let epinglee = 'non'
												if (bloc.hasOwnProperty('epinglee')) {
													epinglee = bloc.epinglee
												}
												const blocId = 'bloc-id-' + (new Date()).getTime() + Math.random().toString(16).slice(10)
												await db
												.multi()
												.HSET('contenu-blocs:' + id + ':' + blocId, ['id', bloc.id, 'bloc', blocId, 'typeBloc', bloc.typeBloc, 'titre', bloc.titre, 'texte', bloc.texte, 'media', bloc.media, 'iframe', bloc.iframe, 'type', bloc.type, 'source', bloc.source, 'vignette', bloc.vignette, 'vignetteActivee', bloc.vignetteActivee, 'mediaExtra', bloc.mediaExtra, 'medias', bloc.medias, 'edition', bloc.edition, 'date', date, 'identifiant', bloc.identifiant, 'commentaires', commentaires, 'evaluations', evaluations, 'colonne', bloc.colonne, 'visibilite', bloc.visibilite, 'motdepasse', motdepasse, 'epinglee', epinglee, 'couleur', bloc.couleur])
												.ZADD('blocs:' + id, [{ score: indexBloc, value: blocId }])
												.exec()
												if (parametres.commentaires === true) {
													for (const commentaire of bloc.listeCommentaires) {
														if (commentaire.hasOwnProperty('id') && commentaire.hasOwnProperty('identifiant') && commentaire.hasOwnProperty('date') && commentaire.hasOwnProperty('texte')) {
															await db.ZADD('commentaires:' + blocId, [{ score: commentaire.id, value: JSON.stringify(commentaire) }])
														}
													}
												}
												if (parametres.evaluations === true) {
													for (const evaluation of bloc.listeEvaluations) {
														if (evaluation.hasOwnProperty('id') && evaluation.hasOwnProperty('identifiant') && evaluation.hasOwnProperty('date') && evaluation.hasOwnProperty('etoiles')) {
															await db.ZADD('evaluations:' + blocId, [{ score: evaluation.id, value: JSON.stringify(evaluation) }])
														}
													}
												}
												if (stockage === 'fs' && bloc.hasOwnProperty('media') && bloc.media !== '' && bloc.type !== 'embed' && bloc.type !== 'lien' && await fs.pathExists(path.normalize(cible + '/fichiers/' + bloc.media))) {
													await fs.copy(path.normalize(cible + '/fichiers/' + bloc.media), path.normalize(chemin + '/' + bloc.media, { overwrite: true }))
												} else if (stockage === 's3' && bloc.hasOwnProperty('media') && bloc.media !== '' && bloc.type !== 'embed' && bloc.type !== 'lien' && await fs.pathExists(path.normalize(cible + '/fichiers/' + bloc.media))) {
													const buffer = await fs.readFile(path.normalize(cible + '/fichiers/' + bloc.media))
													await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: id + '/' + bloc.media, Body: buffer, ACL: 'public-read' }))
												}
												if (stockage === 'fs' && bloc.hasOwnProperty('mediaExtra') && bloc.mediaExtra !== '' && await fs.pathExists(path.normalize(cible + '/fichiers/' + bloc.mediaExtra))) {
													await fs.copy(path.normalize(cible + '/fichiers/' + bloc.mediaExtra), path.normalize(chemin + '/' + bloc.mediaExtra, { overwrite: true }))
												} else if (stockage === 's3' && bloc.hasOwnProperty('mediaExtra') && bloc.mediaExtra !== '' && await fs.pathExists(path.normalize(cible + '/fichiers/' + bloc.mediaExtra))) {
													const buffer = await fs.readFile(path.normalize(cible + '/fichiers/' + bloc.mediaExtra))
													await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: id + '/' + bloc.mediaExtra, Body: buffer, ACL: 'public-read' }))
												}
												if (bloc.hasOwnProperty('medias')) {
													const medias = JSON.parse(bloc.medias)
													for (let i = 0; i < medias.length; i++) {
														if (stockage === 'fs' && medias[i].hasOwnProperty('fichier') && medias[i].fichier !== '' && await fs.pathExists(path.normalize(cible + '/fichiers/' + medias[i].fichier))) {
															await fs.copy(path.normalize(cible + '/fichiers/' + medias[i].fichier), path.normalize(chemin + '/' + medias[i].fichier, { overwrite: true }))
														} else if (stockage === 's3' && medias[i].hasOwnProperty('fichier') && medias[i].fichier !== '' && await fs.pathExists(path.normalize(cible + '/fichiers/' + medias[i].fichier))) {
															const buffer = await fs.readFile(path.normalize(cible + '/fichiers/' + medias[i].fichier))
															await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: id + '/' + medias[i].fichier, Body: buffer, ACL: 'public-read' }))
														}
													}
												}
												if (stockage === 'fs' && bloc.hasOwnProperty('vignette') && definirVignettePersonnalisee(bloc.vignette) === true && await fs.pathExists(path.normalize(cible + '/fichiers/' + path.basename(bloc.vignette)))) {
													await fs.copy(path.normalize(cible + '/fichiers/' + path.basename(bloc.vignette)), path.normalize(chemin + '/' + path.basename(bloc.vignette), { overwrite: true }))
												} else if (stockage === 's3' && bloc.hasOwnProperty('vignette') && definirVignettePersonnalisee(bloc.vignette) === true && await fs.pathExists(path.normalize(cible + '/fichiers/' + path.basename(bloc.vignette)))) {
													const buffer = await fs.readFile(path.normalize(cible + '/fichiers/' + path.basename(bloc.vignette)))
													await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: id + '/' + path.basename(bloc.vignette), Body: buffer, ACL: 'public-read' }))
												}
												resolve({ bloc: bloc.bloc, blocId: blocId })
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
										const code = Math.floor(100000 + Math.random() * 900000)
										let activiteId = 0
										if (parametres.activite === true) {
											activiteId = donnees.mur.activite
										}
										if (stockage === 'fs' && !donnees.mur.fond.includes('/img/') && donnees.mur.fond.substring(0, 1) !== '#' && donnees.mur.fond !== '' && await fs.pathExists(path.normalize(cible + '/fichiers/' + path.basename(donnees.mur.fond)))) {
											await fs.copy(path.normalize(cible + '/fichiers/' + path.basename(donnees.mur.fond)), path.normalize(chemin + '/' + path.basename(donnees.mur.fond), { overwrite: true }))
										} else if (stockage === 's3' && !donnees.mur.fond.includes('/img/') && donnees.mur.fond.substring(0, 1) !== '#' && donnees.mur.fond !== '' && await fs.pathExists(path.normalize(cible + '/fichiers/' + path.basename(donnees.mur.fond)))) {
											const buffer = await fs.readFile(path.normalize(cible + '/fichiers/' + path.basename(donnees.mur.fond)))
											await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: id + '/' + path.basename(donnees.mur.fond), Body: buffer, ACL: 'public-read' }))
										}
										let epinglage = 'desactive'
										if (donnees.mur.hasOwnProperty('epinglage')) {
											epinglage = donnees.mur.epinglage
										}
										await db
										.multi()
										.INCR('mur')
										.HSET('murs:' + id, ['id', id, 'token', token, 'titre', titre, 'identifiant', identifiant, 'motdepasse', hash, 'fond', donnees.mur.fond, 'acces', donnees.mur.acces, 'motdepasseAdmin', '', 'code', code, 'contributions', donnees.mur.contributions, 'affichage', donnees.mur.affichage, 'registreActivite', donnees.mur.registreActivite, 'conversation', donnees.mur.conversation, 'listeUtilisateurs', donnees.mur.listeUtilisateurs, 'editionNom', donnees.mur.editionNom, 'fichiers', donnees.mur.fichiers, 'enregistrements', donnees.mur.enregistrements, 'liens', donnees.mur.liens, 'documents', donnees.mur.documents, 'commentaires', donnees.mur.commentaires, 'evaluations', donnees.mur.evaluations, 'verrouillage', donnees.mur.verrouillage, 'epinglage', epinglage, 'copieBloc', donnees.mur.copieBloc, 'ordre', donnees.mur.ordre, 'largeur', donnees.mur.largeur, 'date', date, 'colonnes', donnees.mur.colonnes, 'affichageColonnes', donnees.mur.affichageColonnes, 'bloc', donnees.mur.bloc, 'activite', activiteId, 'admins', JSON.stringify([]), 'vues', 0, 'digidrive', 1])
										.HSET('utilisateurs:' + identifiant, ['id', identifiant, 'date', date, 'nom', nom, 'langue', langue])
										.SADD('murs-crees:' + identifiant, id.toString())
										.exec()
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
													await db.ZADD('activite:' + id, [{ score: activite.id, value: JSON.stringify(activite) }])
												}
											}
										}
										await fs.remove(source)
										await fs.remove(cible)
										res.send(id + '/' + token + '/' + slug)
									})
								}
							})
						} else {
							await fs.remove(source)
							await fs.remove(cible)
							res.send('donnees_corrompues')
						}
					}
				})
			} catch (err) {
				await fs.remove(path.join(__dirname, '..', '/static/temp/' + req.file.filename))
				res.send('erreur_import')
			}
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

	const io = new Server(httpServer, {
		wsEngine: eiows.Server,
		pingInterval: 95000,
    	pingTimeout: 100000,
    	maxHttpBufferSize: 1e8,
		cookie: false,
		perMessageDeflate: false
	})
	if (cluster === true) {
		io.adapter(createAdapter())
	}
	const wrap = middleware => (socket, next) => middleware(socket.request, {}, next)
	io.use(wrap(sessionMiddleware))

	io.on('connection', function (socket) {
		const req = socket.request
		socket.use(function (__, next) {
			req.session.reload(function (err) {
				if (err) {
					socket.disconnect()
				} else {
					next()
				}
			})
		})

		socket.on('connexion', async function (donnees) {
			const mur = donnees.mur
			const identifiant = donnees.identifiant
			const nom = donnees.nom
			const room = 'mur-' + mur
			socket.data.identifiant = identifiant
			socket.data.nom = nom
			socket.join(room)
			const clients = await fetchSockets(room)
			const utilisateurs = []
			if (clients !== null && clients instanceof Array) {
				for (let i = 0; i < clients.length; i++) {
					utilisateurs.push({ identifiant: clients[i].data.identifiant, nom: clients[i].data.nom })
				}
			}
			const utilisateursConnectes = utilisateurs.filter((v, i, a) => a.findIndex(t => (t.identifiant === v.identifiant)) === i)
			io.to(room).emit('connexion', utilisateursConnectes)
		})

		socket.on('sortie', function (mur, identifiant) {
			socket.leave('mur-' + mur)
			socket.to('mur-' + mur).emit('deconnexion', identifiant)
		})

		socket.on('disconnecting', function () {
			if (req.session.identifiant !== '') {
				socket.rooms.forEach(function (room) {
					io.to(room).emit('deconnexion', req.session.identifiant)
				})
			}
		})

		socket.on('deconnexion', function (identifiant) {
			if (req.session.hasOwnProperty('identifiant')) {
				req.session.identifiant = ''
				req.session.motdepasse = ''
				req.session.nom = ''
				req.session.email = ''
				req.session.langue = ''
				req.session.statut = ''
				req.session.save()
			}
			if (identifiant !== '') {
				socket.rooms.forEach(function (room) {
					io.to(room).emit('deconnexion', req.session.identifiant)
				})
			}
		})

		socket.on('verifieracces', async function (donnees) {
			const mur = donnees.mur
			const identifiant = donnees.identifiant
			let code = ''
			if (donnees.code === '') {
				if (!req.session.hasOwnProperty('acces')) {
					req.session.acces = []
				}
				req.session.acces.map(function (e) {
					if (e.hasOwnProperty('mur') && parseInt(e.mur) === parseInt(mur)) {
						code = e.code 
					}
				})
			} else {
				code = donnees.code
			}
			if (req.session.identifiant === identifiant && code !== '') {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('code')) { socket.emit('erreur'); return false }
				if (code === donnees.code) {
					const donneesMur = await recupererDonneesMurProtege(donnees, mur, identifiant)
					socket.emit('verifieracces', { acces: true, mur: donneesMur.mur, blocs: donneesMur.blocs, activite: donneesMur.activite.reverse() })
				} else {
					socket.emit('verifieracces', { acces: false })
				}
			} else {
				socket.emit('verifieracces', { acces: false })
			}
		})

		socket.on('ajouterbloc', async function (bloc, typeBloc, mur, token, titre, texte, media, iframe, type, source, vignette, vignetteActivee, mediaExtra, medias, couleur, colonne, visible, protegee, motdepasse, identifiant, nom) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('id') || !donnees.hasOwnProperty('token') || !donnees.hasOwnProperty('identifiant') || !donnees.hasOwnProperty('bloc') || !donnees.hasOwnProperty('verrouillage')) { socket.emit('erreur'); return false }
				const admin = await verifierAdmin(mur, donnees, req.session)
				if (donnees.id === mur && donnees.token === token && (donnees.contributions !== 'fermees' || admin)) {
					const id = parseInt(donnees.bloc) + 1
					const date = dayjs().format()
					const activiteId = parseInt(donnees.activite) + 1
					let visibilite = 'visible'
					if (admin && protegee === true) {
						visibilite = 'protegee'
					} else if (admin && visible === false) {
						visibilite = 'privee'
					} else if (!admin && donnees.contributions === 'moderees') {
						visibilite = 'masquee'
					}
					let edition = 'oui'
					if (donnees.verrouillage === 'active') {
						edition = 'non'
					}
					if (vignetteActivee === true) {
						vignetteActivee = 'oui'
					} else {
						vignetteActivee = 'non'
					}
					if (vignette && definirVignettePersonnalisee(vignette) === true) {
						vignette = path.basename(vignette)
					}
					await db
					.multi()
					.HSET('contenu-blocs:' + mur + ':' + bloc, ['id', id, 'bloc', bloc, 'typeBloc', typeBloc, 'titre', titre, 'texte', texte, 'media', media, 'iframe', iframe, 'type', type, 'source', source, 'vignette', vignette, 'vignetteActivee', vignetteActivee, 'mediaExtra', mediaExtra, 'medias', JSON.stringify(medias), 'edition', edition, 'date', date, 'identifiant', identifiant, 'commentaires', 0, 'evaluations', 0, 'colonne', colonne, 'visibilite', visibilite, 'motdepasse', motdepasse, 'epinglee', 'non', 'couleur', couleur])
					.ZADD('blocs:' + mur, [{ score: id, value: bloc }])
					.HSET('murs:' + mur, 'bloc', id)
					.HSET('dates-murs:' + mur, 'date', date)
					.exec()
					if (visibilite === 'visible' || visibilite === 'protegee') {
						// Enregistrer entrée du registre d'activité
						await db
						.multi()
						.HINCRBY('murs:' + mur, 'activite', 1)
						.ZADD('activite:' + mur, [{ score: activiteId, value: JSON.stringify({ id: activiteId, bloc: bloc, identifiant: identifiant, titre: titre, date: date, type: 'bloc-ajoute' }) }])
						.exec()
					}
					if (stockage === 'fs' && media !== '' && type !== 'embed' && type !== 'lien' && await fs.pathExists(path.join(__dirname, '..', '/static/temp/' + media))) {
						await fs.copy(path.join(__dirname, '..', '/static/temp/' + media), path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + mur + '/' + media))
						await fs.remove(path.join(__dirname, '..', '/static/temp/' + media))
					} else if (stockage === 's3' && media !== '' && type !== 'embed' && type !== 'lien') {
						try {
							const fichierMeta = await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: 'temp/' + media }))
							if (fichierMeta.hasOwnProperty('ContentLength')) {
								await s3Client.send(new CopyObjectCommand({ Bucket: bucket, Key: mur + '/' + media, CopySource: '/' + bucket + '/temp/' + media, ACL: 'public-read' }))
								await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: 'temp/' + media }))
							}
						} catch (e) {}
					}
					if (stockage === 'fs' && mediaExtra !== '' && await fs.pathExists(path.join(__dirname, '..', '/static/temp/' + mediaExtra))) {
						await fs.copy(path.join(__dirname, '..', '/static/temp/' + mediaExtra), path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + mur + '/' + mediaExtra))
						await fs.remove(path.join(__dirname, '..', '/static/temp/' + mediaExtra))
					} else if (stockage === 's3' && mediaExtra !== '') {
						try {
							const fichierMeta = await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: 'temp/' + mediaExtra }))
							if (fichierMeta.hasOwnProperty('ContentLength')) {
								await s3Client.send(new CopyObjectCommand({ Bucket: bucket, Key: mur + '/' + mediaExtra, CopySource: '/' + bucket + '/temp/' + mediaExtra, ACL: 'public-read' }))
								await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: 'temp/' + mediaExtra }))
							}
						} catch (e) {}
					}
					for (let i = 0; i < medias.length; i++) {
						if (stockage === 'fs' && medias[i].fichier !== '' && await fs.pathExists(path.join(__dirname, '..', '/static/temp/' + medias[i].fichier))) {
							await fs.copy(path.join(__dirname, '..', '/static/temp/' + medias[i].fichier), path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + mur + '/' + medias[i].fichier))
							await fs.remove(path.join(__dirname, '..', '/static/temp/' + medias[i].fichier))
						} else if (stockage === 's3' && medias[i].fichier !== '') {
							try {
								const fichierMeta = await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: 'temp/' + medias[i].fichier }))
								if (fichierMeta.hasOwnProperty('ContentLength')) {
									await s3Client.send(new CopyObjectCommand({ Bucket: bucket, Key: mur + '/' + medias[i].fichier, CopySource: '/' + bucket + '/temp/' + medias[i].fichier, ACL: 'public-read' }))
									await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: 'temp/' + medias[i].fichier }))
								}
							} catch (e) {}
						}
					}
					if (stockage === 'fs' && vignette && definirVignettePersonnalisee(vignette) === true && await fs.pathExists(path.join(__dirname, '..', '/static/temp/' + vignette))) {
						await fs.copy(path.join(__dirname, '..', '/static/temp/' + vignette), path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + mur + '/' + vignette))
						await fs.remove(path.join(__dirname, '..', '/static/temp/' + vignette))
					} else if (stockage === 's3' && vignette && definirVignettePersonnalisee(vignette) === true) {
						try {
							const fichierMeta = await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: 'temp/' + vignette }))
							if (fichierMeta.hasOwnProperty('ContentLength')) {
								await s3Client.send(new CopyObjectCommand({ Bucket: bucket, Key: mur + '/' + vignette, CopySource: '/' + bucket + '/temp/' + vignette, ACL: 'public-read' }))
								await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: 'temp/' + vignette }))
							}
						} catch (e) {}
					}
					io.to('mur-' + mur).emit('ajouterbloc', { bloc: bloc, typeBloc: typeBloc, titre: titre, texte: texte, media: media, iframe: iframe, type: type, source: source, vignette: vignette, vignetteActivee: vignetteActivee, mediaExtra: mediaExtra, medias: medias, edition: edition, identifiant: identifiant, nom: nom, date: date, couleur: couleur, commentaires: 0, evaluations: [], colonne: colonne, visibilite: visibilite, motdepasse: motdepasse, activiteId: activiteId })
					req.session.cookie.expires = new Date(Date.now() + dureeSession)
					req.session.save()
				} else {
					socket.emit('nonautorise')
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifierbloc', async function (bloc, typeBloc, mur, token, titre, texte, media, iframe, type, source, vignette, vignetteActivee, mediaExtra, medias, couleur, colonne, visible, protegee, motdepasse, identifiant, nom) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('id') || !donnees.hasOwnProperty('token')) { socket.emit('erreur'); return false }
				if (donnees.id === mur && donnees.token === token) {
					const resultat = await db.EXISTS('contenu-blocs:' + mur + ':' + bloc)
					if (resultat === null) { socket.emit('erreur'); return false }
					if (resultat === 1) {
						let objet = await db.HGETALL('contenu-blocs:' + mur + ':' + bloc)
						objet = Object.assign({}, objet)
						if (objet === null) { socket.emit('erreur'); return false }
						const admin = await verifierAdmin(mur, donnees, req.session)
						if (objet.identifiant === identifiant || admin || donnees.contributions === 'modifiables')  {
							let visibilite = 'visible'
							if (objet.hasOwnProperty('visibilite')) {
								visibilite = objet.visibilite
							}
							/*if (visibilite !== 'masquee' && protegee === false && visible === true) {
								visibilite = 'visible'
							}*/
							if (protegee === true) {
								visibilite = 'protegee'
							} else if (visible === false) {
								visibilite = 'privee'
							}
							if (vignetteActivee === true) {
								vignetteActivee = 'oui'
							} else {
								vignetteActivee = 'non'
							}
							const edition = objet.edition
							const date = dayjs().format()
							if (vignette && objet.hasOwnProperty('vignette') && path.basename(objet.vignette) !== path.basename(vignette) && definirVignettePersonnalisee(vignette) === true) {
								vignette = path.basename(vignette)
							}
							const activiteId = parseInt(donnees.activite) + 1
							if (visibilite === 'visible' || visibilite === 'protegee' || visibilite === 'privee' || visibilite === 'masquee') {
								// Enregistrer entrée du registre d'activité
								if (visibilite === 'visible' || visibilite === 'masquee') {
									await db
									.multi()
									.HINCRBY('murs:' + mur, 'activite', 1)
									.ZADD('activite:' + mur, [{ score: activiteId, value: JSON.stringify({ id: activiteId, bloc: bloc, identifiant: identifiant, titre: titre, date: date, type: 'bloc-modifie' }) }])
									.exec()
								}
								await db
								.multi()
								.HSET('contenu-blocs:' + mur + ':' + bloc, ['typeBloc', typeBloc, 'titre', titre, 'texte', texte, 'media', media, 'iframe', iframe, 'type', type, 'source', source, 'vignette', vignette, 'vignetteActivee', vignetteActivee, 'mediaExtra', mediaExtra, 'medias', JSON.stringify(medias), 'visibilite', visibilite, 'motdepasse', motdepasse, 'modifie', date, 'couleur', couleur])
								.HSET('dates-murs:' + mur, 'date', date)
								.exec()
							}
							if (stockage === 'fs' && objet.hasOwnProperty('media') && objet.media !== media && media !== '' && type !== 'embed' && type !== 'lien' && await fs.pathExists(path.join(__dirname, '..', '/static/temp/' + media))) {
								await fs.copy(path.join(__dirname, '..', '/static/temp/' + media), path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + mur + '/' + media))
								await fs.remove(path.join(__dirname, '..', '/static/temp/' + media))
							} else if (stockage === 's3' && objet.hasOwnProperty('media') && objet.media !== media && media !== '' && type !== 'embed' && type !== 'lien') {
								try {
									const fichierMeta = await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: 'temp/' + media }))
									if (fichierMeta.hasOwnProperty('ContentLength')) {
										await s3Client.send(new CopyObjectCommand({ Bucket: bucket, Key: mur + '/' + media, CopySource: '/' + bucket + '/temp/' + media, ACL: 'public-read' }))
										await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: 'temp/' + media }))
									}
								} catch (e) {}
							}
							if (objet.hasOwnProperty('media') && objet.media !== media && objet.media !== '' && objet.type !== 'embed' && objet.type !== 'lien') {
								await supprimerFichier(mur, objet.media)
							}
							if (stockage === 'fs' && objet.hasOwnProperty('mediaExtra') && objet.mediaExtra !== mediaExtra && mediaExtra !== '' && await fs.pathExists(path.join(__dirname, '..', '/static/temp/' + mediaExtra))) {
								await fs.copy(path.join(__dirname, '..', '/static/temp/' + mediaExtra), path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + mur + '/' + mediaExtra))
								await fs.remove(path.join(__dirname, '..', '/static/temp/' + mediaExtra))
							} else if (stockage === 's3' && objet.hasOwnProperty('mediaExtra') && objet.mediaExtra !== mediaExtra && mediaExtra !== '') {
								try {
									const fichierMeta = await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: 'temp/' + mediaExtra }))
									if (fichierMeta.hasOwnProperty('ContentLength')) {
										await s3Client.send(new CopyObjectCommand({ Bucket: bucket, Key: mur + '/' + mediaExtra, CopySource: '/' + bucket + '/temp/' + mediaExtra, ACL: 'public-read' }))
										await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: 'temp/' + mediaExtra }))
									}
								} catch (e) {}
							}
							if (objet.hasOwnProperty('mediaExtra') && objet.mediaExtra !== mediaExtra && objet.mediaExtra !== '') {
								await supprimerFichier(mur, objet.mediaExtra)
							}
							if (objet.hasOwnProperty('medias')) {
								const mediasActuels = JSON.parse(objet.medias)
								for (let i = 0; i < medias.length; i++) {
									if (stockage === 'fs' && medias[i].hasOwnProperty('fichier') && medias[i].fichier !== '' && !mediasActuels.map(function (e) { return e.fichier }).includes(medias[i].fichier) && await fs.pathExists(path.join(__dirname, '..', '/static/temp/' + medias[i].fichier))) {
										await fs.copy(path.join(__dirname, '..', '/static/temp/' + medias[i].fichier), path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + mur + '/' + medias[i].fichier))
										await fs.remove(path.join(__dirname, '..', '/static/temp/' + medias[i].fichier))
									} else if (stockage === 's3' && medias[i].hasOwnProperty('fichier') && medias[i].fichier !== '' && !mediasActuels.map(function (e) { return e.fichier }).includes(medias[i].fichier)) {
										try {
											const fichierMeta = await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: 'temp/' + medias[i].fichier }))
											if (fichierMeta.hasOwnProperty('ContentLength')) {
												await s3Client.send(new CopyObjectCommand({ Bucket: bucket, Key: mur + '/' + medias[i].fichier, CopySource: '/' + bucket + '/temp/' + medias[i].fichier, ACL: 'public-read' }))
												await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: 'temp/' + medias[i].fichier }))
											}
										} catch (e) {}
									}
								}
								mediasActuels.forEach(async function (mediaActuel) {
									if (mediaActuel.hasOwnProperty('fichier') && !medias.map(function (e) { return e.fichier }).includes(mediaActuel.fichier)) {
										await supprimerFichier(mur, mediaActuel.fichier)
									}
								})
							}
							if (stockage === 'fs' && vignette && objet.hasOwnProperty('vignette') && path.basename(objet.vignette) !== vignette && definirVignettePersonnalisee(vignette) === true && await fs.pathExists(path.join(__dirname, '..', '/static/temp/' + vignette))) {
								await fs.copy(path.join(__dirname, '..', '/static/temp/' + vignette), path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + mur + '/' + vignette))
								await fs.remove(path.join(__dirname, '..', '/static/temp/' + vignette))
							} else if (stockage === 's3' && vignette && objet.hasOwnProperty('vignette') && path.basename(objet.vignette) !== vignette && definirVignettePersonnalisee(vignette) === true) {
								try {
									const fichierMeta = await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: 'temp/' + vignette }))
									if (fichierMeta.hasOwnProperty('ContentLength')) {
										await s3Client.send(new CopyObjectCommand({ Bucket: bucket, Key: mur + '/' + vignette, CopySource: '/' + bucket + '/temp/' + vignette, ACL: 'public-read' }))
										await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: 'temp/' + vignette }))
									}
								} catch (e) {}
							}
							if (objet.hasOwnProperty('vignette') && path.basename(objet.vignette) !== vignette && definirVignettePersonnalisee(objet.vignette) === true) {
								await supprimerFichier(mur, path.basename(objet.vignette))
							}
							io.to('mur-' + mur).emit('modifierbloc', { bloc: bloc, typeBloc: typeBloc, titre: titre, texte: texte, media: media, iframe: iframe, type: type, source: source, vignette: vignette, vignetteActivee: vignetteActivee, mediaExtra: mediaExtra, medias: medias, edition: edition, identifiant: identifiant, nom: nom, modifie: date, couleur: couleur, colonne: colonne, visibilite: visibilite, motdepasse: motdepasse, activiteId: activiteId })
							req.session.cookie.expires = new Date(Date.now() + dureeSession)
							req.session.save()
						} else {
							socket.emit('nonautorise')
						}
					}
				} else {
					socket.emit('nonautorise')
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('copierbloc', async function (bloc, typeBloc, mur, token, titre, texte, media, iframe, type, source, vignette, vignetteActivee, mediaExtra, medias, couleur, colonne, visibilite, motdepasse, identifiant, nom, murOrigine) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('id') || !donnees.hasOwnProperty('token') || !donnees.hasOwnProperty('identifiant') || !donnees.hasOwnProperty('bloc')) { socket.emit('erreur'); return false }
				if (donnees.id === mur && donnees.token === token && await verifierAdmin(mur, donnees, req.session) === true) {
					const id = parseInt(donnees.bloc) + 1
					const date = dayjs().format()
					const activiteId = parseInt(donnees.activite) + 1
					if (vignetteActivee === true) {
						vignetteActivee = 'oui'
					} else {
						vignetteActivee = 'non'
					}
					if (vignette && definirVignettePersonnalisee(vignette) === true) {
						vignette = path.basename(vignette)
					}
					await db
					.multi()
					.HSET('contenu-blocs:' + mur + ':' + bloc, ['id', id, 'bloc', bloc, 'typeBloc', typeBloc, 'titre', titre, 'texte', texte, 'media', media, 'iframe', iframe, 'type', type, 'source', source, 'vignette', vignette, 'vignetteActivee', vignetteActivee, 'mediaExtra', mediaExtra, 'medias', JSON.stringify(medias), 'edition', 'oui', 'date', date, 'identifiant', identifiant, 'commentaires', 0, 'evaluations', 0, 'colonne', colonne, 'visibilite', visibilite, 'motdepasse', motdepasse, 'epinglee', 'non', 'couleur', couleur])
					.ZADD('blocs:' + mur, [{ score: id, value: bloc }])
					.HSET('murs:' + mur, 'bloc', id)
					.HSET('dates-murs:' + mur, 'date', date)
					.exec()
					if (visibilite === 'visible' || visibilite === 'protegee') {
						// Enregistrer entrée du registre d'activité
						await db
						.multi()
						.HINCRBY('murs:' + mur, 'activite', 1)
						.ZADD('activite:' + mur, [{ score: activiteId, value: JSON.stringify({ id: activiteId, bloc: bloc, identifiant: identifiant, titre: titre, date: date, type: 'bloc-ajoute' }) }])
						.exec()
					}
					if (stockage === 'fs' && media !== '' && type !== 'embed' && type !== 'lien' && await fs.pathExists(path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + murOrigine + '/' + media))) {
						await fs.copy(path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + murOrigine + '/' + media), path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + mur + '/' + media))
					} else if (stockage === 's3' && media !== '' && type !== 'embed' && type !== 'lien') {
						try {
							const fichierMeta = await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: murOrigine + '/' + media }))
							if (fichierMeta.hasOwnProperty('ContentLength')) {
								await s3Client.send(new CopyObjectCommand({ Bucket: bucket, Key: mur + '/' + media, CopySource: '/' + bucket + '/' + murOrigine + '/' + media, ACL: 'public-read' }))
							}
						} catch (e) {}
					}
					if (stockage === 'fs' && mediaExtra !== '' && await fs.pathExists(path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + murOrigine + '/' + mediaExtra))) {
						await fs.copy(path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + murOrigine + '/' + mediaExtra), path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + mur + '/' + mediaExtra))
					} else if (stockage === 's3' && mediaExtra !== '') {
						try {
							const fichierMeta = await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: murOrigine + '/' + mediaExtra }))
							if (fichierMeta.hasOwnProperty('ContentLength')) {
								await s3Client.send(new CopyObjectCommand({ Bucket: bucket, Key: mur + '/' + mediaExtra, CopySource: '/' + bucket + '/' + murOrigine + '/' + mediaExtra, ACL: 'public-read' }))
							}
						} catch (e) {}
					}
					for (let i = 0; i < medias.length; i++) {
						if (stockage === 'fs' && medias[i].fichier !== '' && await fs.pathExists(path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + murOrigine + '/' + medias[i].fichier))) {
							await fs.copy(path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + murOrigine + '/' + medias[i].fichier), path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + mur + '/' + medias[i].fichier))
						} else if (stockage === 's3' && medias[i].fichier !== '') {
							try {
								const fichierMeta = await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: murOrigine + '/' + medias[i].fichier }))
								if (fichierMeta.hasOwnProperty('ContentLength')) {
									await s3Client.send(new CopyObjectCommand({ Bucket: bucket, Key: mur + '/' + medias[i].fichier, CopySource: '/' + bucket + '/' + murOrigine + '/' + medias[i].fichier, ACL: 'public-read' }))
								}
							} catch (e) {}
						}
					}
					if (stockage === 'fs' && vignette && vignette !== '' && !String(vignette).includes('/img/') && !verifierURL(vignette, ['https', 'http']) && await fs.pathExists(path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + murOrigine + '/' + vignette))) {
						await fs.copy(path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + murOrigine + '/' + vignette), path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + mur + '/' + vignette))
					} else if (stockage === 's3' && vignette && vignette !== '' && !String(vignette).includes('/img/') && !verifierURL(vignette, ['https', 'http'])) {
						try {
							const fichierMeta = await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: murOrigine + '/' + vignette }))
							if (fichierMeta.hasOwnProperty('ContentLength')) {
								await s3Client.send(new CopyObjectCommand({ Bucket: bucket, Key: mur + '/' + vignette, CopySource: '/' + bucket + '/' + murOrigine + '/' + vignette, ACL: 'public-read' }))
							}
						} catch (e) {}
					}
					io.to('mur-' + mur).emit('ajouterbloc', { bloc: bloc, typeBloc: typeBloc, titre: titre, texte: texte, media: media, iframe: iframe, type: type, source: source, vignette: vignette, vignetteActivee: vignetteActivee, mediaExtra: mediaExtra, medias: medias, edition: 'oui', identifiant: identifiant, nom: nom, date: date, couleur: couleur, commentaires: 0, evaluations: [], colonne: colonne, visibilite: visibilite, motdepasse: motdepasse, epinglee: 'non', activiteId: activiteId })
					socket.emit('copierbloc')
					req.session.cookie.expires = new Date(Date.now() + dureeSession)
					req.session.save()
				} else {
					socket.emit('nonautorise')
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('verrouillerbloc', async function (mur, token, bloc, colonne, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('identifiant')) { socket.emit('erreur'); return false }
				if (donnees.id === mur && donnees.token === token && await verifierAdmin(mur, donnees, req.session) === true) {
					const resultat = await db.EXISTS('contenu-blocs:' + mur + ':' + bloc)
					if (resultat === null) { socket.emit('erreur'); return false }
					if (resultat === 1) {
						await db.HSET('contenu-blocs:' + mur + ':' + bloc, 'edition', 'non')
						io.to('mur-' + mur).emit('verrouillerbloc', { bloc: bloc, colonne: colonne, identifiant: identifiant })
						req.session.cookie.expires = new Date(Date.now() + dureeSession)
						req.session.save()
					}
				} else {
					socket.emit('nonautorise')
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('deverrouillerbloc', async function (mur, token, bloc, colonne, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('identifiant')) { socket.emit('erreur'); return false }
				if (donnees.id === mur && donnees.token === token && await verifierAdmin(mur, donnees, req.session) === true) {
					const resultat = await db.EXISTS('contenu-blocs:' + mur + ':' + bloc)
					if (resultat === null) { socket.emit('erreur'); return false }
					if (resultat === 1) {
						await db.HSET('contenu-blocs:' + mur + ':' + bloc, 'edition', 'oui')
						io.to('mur-' + mur).emit('deverrouillerbloc', { bloc: bloc, colonne: colonne, identifiant: identifiant })
						req.session.cookie.expires = new Date(Date.now() + dureeSession)
						req.session.save()
					}
				} else {
					socket.emit('nonautorise')
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('epinglerbloc', async function (mur, token, bloc, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('identifiant')) { socket.emit('erreur'); return false }
				if (donnees.id === mur && donnees.token === token && await verifierAdmin(mur, donnees, req.session) === true) {
					const resultat = await db.EXISTS('contenu-blocs:' + mur + ':' + bloc)
					if (resultat === null) { socket.emit('erreur'); return false }
					if (resultat === 1) {
						await db.HSET('contenu-blocs:' + mur + ':' + bloc, 'epinglee', 'oui')
						io.to('mur-' + mur).emit('epinglerbloc', { bloc: bloc, identifiant: identifiant })
						req.session.cookie.expires = new Date(Date.now() + dureeSession)
						req.session.save()
					}
				} else {
					socket.emit('nonautorise')
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('desepinglerbloc', async function (mur, token, bloc, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('identifiant')) { socket.emit('erreur'); return false }
				if (donnees.id === mur && donnees.token === token && await verifierAdmin(mur, donnees, req.session) === true) {
					const resultat = await db.EXISTS('contenu-blocs:' + mur + ':' + bloc)
					if (resultat === null) { socket.emit('erreur'); return false }
					if (resultat === 1) {
						await db.HSET('contenu-blocs:' + mur + ':' + bloc, 'epinglee', 'non')
						io.to('mur-' + mur).emit('desepinglerbloc', { bloc: bloc, identifiant: identifiant })
						req.session.cookie.expires = new Date(Date.now() + dureeSession)
						req.session.save()
					}
				} else {
					socket.emit('nonautorise')
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('autoriserbloc', async function (mur, token, item, indexBloc, indexBlocColonne, moderation, identifiant, nom) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('id') || !donnees.hasOwnProperty('token') || !donnees.hasOwnProperty('identifiant')) { socket.emit('erreur'); return false }
				if (donnees.id === mur && donnees.token === token && await verifierAdmin(mur, donnees, req.session) === true) {
					const resultat = await db.EXISTS('contenu-blocs:' + mur + ':' + item.bloc)
					if (resultat === null) { socket.emit('erreur'); return false }
					if (resultat === 1) {
						const date = dayjs().format()
						const activiteId = parseInt(donnees.activite) + 1
						if (item.hasOwnProperty('modifie')) {
							await db.HDEL('contenu-blocs:' + mur + ':' + item.bloc, 'modifie')
						}
						let nomUtilisateur
						if (moderation === 'privee') {
							await db
							.multi()
							.HSET('contenu-blocs:' + mur + ':' + item.bloc, ['visibilite', 'visible', 'date', date])
							.HSET('dates-murs:' + mur, 'date', date)
							// Enregistrer entrée du registre d'activité
							.HINCRBY('murs:' + mur, 'activite', 1)
							.ZADD('activite:' + mur, [{ score: activiteId, value: JSON.stringify({ id: activiteId, bloc: item.bloc, identifiant: item.identifiant, titre: item.titre, date: date, type: 'bloc-ajoute' }) }])
							.exec()
							nomUtilisateur = item.nom
						} else {
							await db
							.multi()
							.HSET('contenu-blocs:' + mur + ':' + item.bloc, 'visibilite', 'visible')
							// Enregistrer entrée du registre d'activité
							.HINCRBY('murs:' + mur, 'activite', 1)
							.ZADD('activite:' + mur, [{ score: activiteId, value: JSON.stringify({ id: activiteId, bloc: item.bloc, identifiant: identifiant, titre: item.titre, date: date, type: 'bloc-valide' }) }])
							.exec()
							nomUtilisateur = nom
						}
						io.to('mur-' + mur).emit('autoriserbloc', { bloc: item.bloc, typeBloc: item.typeBloc, titre: item.titre, texte: item.texte, media: item.media, iframe: item.iframe, type: item.type, source: item.source, vignette: item.vignette, vignetteActivee: item.vignetteActivee, mediaExtra: item.mediaExtra, medias: item.medias, edition: item.edition, identifiant: item.identifiant, nom: nomUtilisateur, date: date, couleur: item.couleur, commentaires: 0, evaluations: [], colonne: item.colonne, visibilite: 'visible', motdepasse: item.motdepasse, epinglee: item.epinglee, activiteId: activiteId, moderation: moderation, admin: identifiant, indexBloc: indexBloc, indexBlocColonne: indexBlocColonne })
						req.session.cookie.expires = new Date(Date.now() + dureeSession)
						req.session.save()
					}
				} else {
					socket.emit('nonautorise')
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('deplacerbloc', async function (items, mur, affichage, ordre, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('id') || !donnees.hasOwnProperty('identifiant')) { socket.emit('erreur'); return false }
				if (donnees.id === mur && await verifierAdmin(mur, donnees, req.session) === true) {
					if (ordre === 'decroissant') {
						items.reverse()
					}
					const donneesBlocs = []
					for (let i = 0; i < items.length; i++) {
						const donneeBloc = new Promise(async function (resolve) {
							const resultat = await db.EXISTS('contenu-blocs:' + mur + ':' + items[i].bloc)
							if (resultat === null) { resolve('erreur'); return false }
							if (resultat === 1) {
								await db
								.multi()
								.ZREM('blocs:' + mur, items[i].bloc)
								.ZADD('blocs:' + mur, [{ score: i + 1, value: items[i].bloc }])
								.exec()
								if (affichage === 'colonnes') {
									await db.HSET('contenu-blocs:' + mur + ':' + items[i].bloc, 'colonne', items[i].colonne)
								}
								resolve(i)
							} else {
								resolve('erreur')
							}
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
							io.to('mur-' + mur).emit('deplacerbloc', { blocs: items, identifiant: identifiant })
						} else {
							socket.emit('erreur')
						}
					})
				} else {
					socket.emit('nonautorise')
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('supprimerbloc', async function (bloc, mur, token, titre, colonne, identifiant, nom) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('id') || !donnees.hasOwnProperty('token') || !donnees.hasOwnProperty('identifiant')) { socket.emit('erreur'); return false }
				if (donnees.id === mur && donnees.token === token) {
					const resultat = await db.EXISTS('contenu-blocs:' + mur + ':' + bloc)
					if (resultat === null) { socket.emit('erreur'); return false }
					if (resultat === 1) {
						let objet = await db.HGETALL('contenu-blocs:' + mur + ':' + bloc)
						objet = Object.assign({}, objet)
						if (objet === null) { socket.emit('erreur'); return false }
						if (objet.identifiant === identifiant || await verifierAdmin(mur, donnees, req.session) === true) {
							if (objet.hasOwnProperty('media') && objet.media !== '' && objet.type !== 'embed' && objet.type !== 'lien') {
								await supprimerFichier(mur, objet.media)
							}
							if (objet.hasOwnProperty('mediaExtra') && objet.mediaExtra !== '') {
								await supprimerFichier(mur, objet.mediaExtra)
							}
							if (objet.hasOwnProperty('medias')) {
								const medias = JSON.parse(objet.medias)
								for (let i = 0; i < medias.length; i++) {
									if (medias[i].hasOwnProperty('fichier')) {
										await supprimerFichier(mur, medias[i].fichier)
									}
								}
							}
							if (objet.hasOwnProperty('vignette') && definirVignettePersonnalisee(objet.vignette) === true) {
								await supprimerFichier(mur, path.basename(objet.vignette))
							}
							let pad = ''
							if (objet.hasOwnProperty('iframe') && objet.iframe !== '' && objet.iframe.includes(etherpad)) {
								pad = objet.iframe
							}
							if (objet.hasOwnProperty('media') && objet.media !== '' && objet.media.includes(etherpad) && pad === '') {
								pad = objet.media
							}
							if (objet.hasOwnProperty('bloc') && objet.bloc === bloc) {
								const date = dayjs().format()
								const activiteId = parseInt(donnees.activite) + 1
								await db
								.multi()
								.UNLINK('contenu-blocs:' + mur + ':' + bloc)
								.ZREM('blocs:' + mur, bloc)
								.UNLINK('commentaires:' + bloc)
								.UNLINK('evaluations:' + bloc)
								.HSET('dates-murs:' + mur, 'date', date)
								// Enregistrer entrée du registre d'activité
								.HINCRBY('murs:' + mur, 'activite', 1)
								.ZADD('activite:' + mur, [{ score: activiteId, value: JSON.stringify({ id: activiteId, bloc: bloc, identifiant: identifiant, titre: titre, date: date, type: 'bloc-supprime' }) }])
								.exec()
								io.to('mur-' + mur).emit('supprimerbloc', { bloc: bloc, identifiant: identifiant, nom: nom, titre: titre, date: date, colonne: colonne, activiteId: activiteId, etherpad: pad })
								req.session.cookie.expires = new Date(Date.now() + dureeSession)
								req.session.save()
							}
						} else {
							socket.emit('nonautorise')
						}
					}
				} else {
					socket.emit('nonautorise')
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('commenterbloc', async function (bloc, mur, titre, texte, identifiant, nom) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let resultat = await db.HGETALL('murs:' + mur)
				resultat = Object.assign({}, resultat)
				if (resultat === null || !resultat.hasOwnProperty('activite')) { socket.emit('erreur'); return false }
				let donnees = await db.HGETALL('contenu-blocs:' + mur + ':' + bloc)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('commentaires')) { socket.emit('erreur'); return false }
				const commentaires = await db.ZRANGE('commentaires:' + bloc, 0, -1)
				if (commentaires === null) { socket.emit('erreur'); return false }
				const date = dayjs().format()
				const activiteId = parseInt(resultat.activite) + 1
				let commentaireId = parseInt(donnees.commentaires) + 1
				const listeCommentaires = []
				for (let commentaire of commentaires) {
					const commentaireJSON = verifierJSON(commentaire)
					if (commentaireJSON === false) {
						socket.emit('erreur'); return false
					} else {
						listeCommentaires.push(commentaireJSON)
					}
				}
				let maxCommentaireId = 0
				if (listeCommentaires.length > 0) {
					maxCommentaireId = listeCommentaires.reduce(function (p, c) {
						return (p && p.id > c.id) ? p : c
					})
				}
				if (commentaireId === maxCommentaireId.id || commentaireId < maxCommentaireId.id) {
					commentaireId = maxCommentaireId.id + 1
				}
				const commentaire = { id: commentaireId, identifiant: identifiant, date: date, texte: texte }
				await db
				.multi()
				.HSET('contenu-blocs:' + mur + ':' + bloc, 'commentaires', commentaireId)
				.HSET('dates-murs:' + mur, 'date', date)
				.ZADD('commentaires:' + bloc, [{ score: commentaireId, value: JSON.stringify(commentaire) }])
				// Enregistrer entrée du registre d'activité
				.HINCRBY('murs:' + mur, 'activite', 1)
				.ZADD('activite:' + mur, [{ score: activiteId, value: JSON.stringify({ id: activiteId, bloc: bloc, identifiant: identifiant, titre: titre, date: date, type: 'bloc-commente' }) }])
				.exec()
				io.to('mur-' + mur).emit('commenterbloc', { id: commentaireId, bloc: bloc, identifiant: identifiant, nom: nom, texte: texte, titre: titre, date: date, commentaires: commentaires.length + 1, activiteId: activiteId })
				req.session.cookie.expires = new Date(Date.now() + dureeSession)
				req.session.save()
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifiercommentaire', async function (bloc, mur, id, texte, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				const resultats = await db.ZRANGEBYSCORE('commentaires:' + bloc, id, id)
				if (resultats === null) { socket.emit('erreur'); return false }
				const dateModification = dayjs().format()
				const resulatsJSON = verifierJSON(resultats)
				let donnees
				if (resulatsJSON === false) {
					socket.emit('erreur'); return false
				} else {
					donnees = resulatsJSON
				}
				const date = donnees.date
				const commentaire = { id: id, identifiant: donnees.identifiant, date: date, modifie: dateModification, texte: texte }
				await db
				.multi()
				.ZREMRANGEBYSCORE('commentaires:' + bloc, id, id)
				.ZADD('commentaires:' + bloc, [{ score: id, value: JSON.stringify(commentaire) }])
				.HSET('dates-murs:' + mur, 'date', dateModification)
				.exec()
				io.to('mur-' + mur).emit('modifiercommentaire', { id: id, texte: texte })
				req.session.cookie.expires = new Date(Date.now() + dureeSession)
				req.session.save()
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('supprimercommentaire', async function (bloc, mur, id, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				const date = dayjs().format()
				await db
				.multi()
				.ZREMRANGEBYSCORE('commentaires:' + bloc, id, id)
				.HSET('dates-murs:' + mur, 'date', date)
				.exec()
				const commentaires = await db.ZCARD('commentaires:' + bloc)
				if (commentaires === null) { socket.emit('erreur'); return false }
				io.to('mur-' + mur).emit('supprimercommentaire', { id: id, bloc: bloc, commentaires: commentaires })
				req.session.cookie.expires = new Date(Date.now() + dureeSession)
				req.session.save()
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('commentaires', async function (bloc, type) {
			const donneesCommentaires = []
			const commentaires = await db.ZRANGE('commentaires:' + bloc, 0, -1)
			if (commentaires === null) { socket.emit('erreur'); return false }
			for (let commentaire of commentaires) {
				const commentaireJSON = verifierJSON(commentaire)
				if (commentaireJSON === false) {
					socket.emit('erreur'); return false
				} else {
					commentaire = commentaireJSON
				}
				const donneeCommentaire = new Promise(async function (resolve) {
					const identifiant = commentaire.identifiant
					const resultat = await db.EXISTS('utilisateurs:' + identifiant)
					if (resultat === null) { resolve(); return false }
					if (resultat === 1) {
						let utilisateur = await db.HGETALL('utilisateurs:' + identifiant)
						utilisateur = Object.assign({}, utilisateur)
						if (utilisateur === null) { resolve(); return false }
						commentaire.nom = utilisateur.nom
						resolve(commentaire)
					} else {
						const reponse = await db.EXISTS('noms:' + identifiant)
						if (reponse === null) { resolve(); return false }
						if (reponse === 1) {
							const nom = await db.HGET('noms:' + identifiant, 'nom')
							if (nom === null) { resolve(); return false }
							commentaire.nom = nom
							resolve(commentaire)
						} else {
							commentaire.nom = ''
							resolve(commentaire)
						}
					}
				})
				donneesCommentaires.push(donneeCommentaire)
			}
			Promise.all(donneesCommentaires).then(function (resultat) {
				socket.emit('commentaires', { commentaires: resultat, type: type })
			})
		})

		socket.on('evaluerbloc', async function (bloc, mur, titre, etoiles, identifiant, nom) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let resultat = await db.HGETALL('murs:' + mur)
				resultat = Object.assign({}, resultat)
				if (resultat === null || !resultat.hasOwnProperty('activite')) { socket.emit('erreur'); return false }
				let donnees = await db.HGETALL('contenu-blocs:' + mur + ':' + bloc)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('evaluations')) { socket.emit('erreur'); return false }
				const date = dayjs().format()
				const activiteId = parseInt(resultat.activite) + 1
				const evaluationId = parseInt(donnees.evaluations) + 1
				const evaluation = { id: evaluationId, identifiant: identifiant, date: date, etoiles: etoiles }
				await db
				.multi()
				.HINCRBY('contenu-blocs:' + mur + ':' + bloc, 'evaluations', 1)
				.ZADD('evaluations:' + bloc, [{ score: evaluationId, value: JSON.stringify(evaluation) }])
				.HSET('dates-murs:' + mur, 'date', date)
				// Enregistrer entrée du registre d'activité
				.HINCRBY('murs:' + mur, 'activite', 1)
				.ZADD('activite:' + mur, [{ score: activiteId, value: JSON.stringify({ id: activiteId, bloc: bloc, identifiant: identifiant, titre: titre, date: date, type: 'bloc-evalue' }) }])
				.exec()
				io.to('mur-' + mur).emit('evaluerbloc', { id: evaluationId, bloc: bloc, identifiant: identifiant, nom: nom, titre: titre, date: date, evaluation: evaluation, activiteId: activiteId })
				req.session.cookie.expires = new Date(Date.now() + dureeSession)
				req.session.save()
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifierevaluation', async function (bloc, mur, id, etoiles, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				const date = dayjs().format()
				const evaluation = { id: id, identifiant: identifiant, date: date, etoiles: etoiles }
				await db
				.multi()
				.ZREMRANGEBYSCORE('evaluations:' + bloc, id, id)
				.ZADD('evaluations:' + bloc, [{ score: id, value: JSON.stringify(evaluation) }])
				.HSET('dates-murs:' + mur, 'date', date)
				.exec()
				io.to('mur-' + mur).emit('modifierevaluation', { id: id, bloc: bloc, date: date, etoiles: etoiles })
				req.session.cookie.expires = new Date(Date.now() + dureeSession)
				req.session.save()
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('supprimerevaluation', async function (bloc, mur, id, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				const date = dayjs().format()
				await db
				.multi()
				.HSET('dates-murs:' + mur, 'date', date)
				.ZREMRANGEBYSCORE('evaluations:' + bloc, id, id)
				.exec()
				io.to('mur-' + mur).emit('supprimerevaluation', { id: id, bloc: bloc })
				req.session.cookie.expires = new Date(Date.now() + dureeSession)
				req.session.save()
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('verifierblocprotege', async function (mur, bloc, colonne, motdepasse, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				const resultat = await db.EXISTS('contenu-blocs:' + mur + ':' + bloc)
				if (resultat === null) { socket.emit('erreur'); return false }
				if (resultat === 1) {
					let objet = await db.HGETALL('contenu-blocs:' + mur + ':' + bloc)
					objet = Object.assign({}, objet)
					if (objet === null) { socket.emit('erreur'); return false }
					if (objet.bloc === bloc && objet.motdepasse === motdepasse) {
						req.session.blocsAutorises.push(bloc)
						req.session.cookie.expires = new Date(Date.now() + dureeSession)
						req.session.save()
						socket.emit('blocautorise', bloc, colonne)
					} else {
						socket.emit('blocnonautorise')
					}
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifiernom', async function (mur, nom, statut, identifiant) {
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				if (statut === 'invite') {
					await db.HSET('noms:' + identifiant, 'nom', nom)
					io.to('mur-' + mur).emit('modifiernom', { identifiant: identifiant, nom: nom })
					req.session.nom = nom
					req.session.cookie.expires = new Date(Date.now() + dureeSession)
					req.session.save()
				} else if (statut === 'auteur') {
					await db.HSET('utilisateurs:' + identifiant, 'nom', nom)
					io.to('mur-' + mur).emit('modifiernom', { identifiant: identifiant, nom: nom })
					req.session.nom = nom
					req.session.cookie.expires = new Date(Date.now() + dureeSession)
					req.session.save()
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifiertitre', async function (mur, titre, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('identifiant')) { socket.emit('erreur'); return false }
				if (await verifierAdmin(mur, donnees, req.session) === true) {
					await db.HSET('murs:' + mur, 'titre', titre)
					const slug = definirSlug(titre)
					io.to('mur-' + mur).emit('modifiertitre', { titre: titre, slug: slug, identifiant: identifiant })
					req.session.cookie.expires = new Date(Date.now() + dureeSession)
					req.session.save()
				} else {
					socket.emit('nonautorise')
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifiercodeacces', async function (mur, code, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('identifiant')) { socket.emit('erreur'); return false }
				if (await verifierAdmin(mur, donnees, req.session) === true) {
					await db.HSET('murs:' + mur, 'code', code)
					io.to('mur-' + mur).emit('modifiercodeacces', code, identifiant)
					req.session.cookie.expires = new Date(Date.now() + dureeSession)
					req.session.save()
				} else {
					socket.emit('nonautorise')
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifieradmins', async function (mur, admins, motdepasseAdmin, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('identifiant')) { socket.emit('erreur'); return false }
				if (donnees.hasOwnProperty('motdepasse') && await bcrypt.compare(motdepasseAdmin, donnees.motdepasse)) {
					socket.emit('motsdepasseidentiques')
					req.session.cookie.expires = new Date(Date.now() + dureeSession)
					req.session.save()
				} else {
					const listeAdmins = JSON.parse(donnees.admins)
					const proprietaire = donnees.identifiant
					if (listeAdmins.includes(identifiant) || proprietaire === identifiant) {
						await db.HSET('murs:' + mur, ['admins', JSON.stringify(admins), 'motdepasseAdmin', motdepasseAdmin])
						admins.forEach(async function (admin) {
							if (!listeAdmins.includes(admin)) {
								await db.SADD('murs-admins:' + admin, mur.toString())
							}
						})
						listeAdmins.forEach(async function (admin) {
							if (!admins.includes(admin)) {
								await db.SREM('murs-admins:' + admin, mur.toString())
							}
						})
						io.to('mur-' + mur).emit('modifieradmins', admins, motdepasseAdmin, identifiant)
						req.session.cookie.expires = new Date(Date.now() + dureeSession)
						req.session.save()
					} else {
						socket.emit('nonautorise')
					}
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifieracces', async function (mur, acces, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('identifiant')) { socket.emit('erreur'); return false }
				if (await verifierAdmin(mur, donnees, req.session) === true) {
					let code = ''
					if (donnees.hasOwnProperty('code') && donnees.code !== '') {
						code = donnees.code
					} else {
						code = Math.floor(100000 + Math.random() * 900000)
					}
					await db.HSET('murs:' + mur, ['acces', acces, 'code', code])
					io.to('mur-' + mur).emit('modifieracces', { acces: acces, code: code })
					req.session.cookie.expires = new Date(Date.now() + dureeSession)
					req.session.save()
				} else {
					socket.emit('nonautorise')
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifiercontributions', async function (mur, contributions, contributionsPrecedentes, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('identifiant')) { socket.emit('erreur'); return false }
				if (await verifierAdmin(mur, donnees, req.session) === true) {
					await db.HSET('murs:' + mur, 'contributions', contributions)
					io.to('mur-' + mur).emit('modifiercontributions', { contributions: contributions, contributionsPrecedentes: contributionsPrecedentes })
					req.session.cookie.expires = new Date(Date.now() + dureeSession)
					req.session.save()
				} else {
					socket.emit('nonautorise')
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifieraffichage', async function (mur, affichage, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('identifiant')) { socket.emit('erreur'); return false }
				if (await verifierAdmin(mur, donnees, req.session) === true) {
					await db.HSET('murs:' + mur, 'affichage', affichage)
					io.to('mur-' + mur).emit('modifieraffichage', affichage, identifiant)
					req.session.cookie.expires = new Date(Date.now() + dureeSession)
					req.session.save()
				} else {
					socket.emit('nonautorise')
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifierordre', async function (mur, ordre, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('identifiant')) { socket.emit('erreur'); return false }
				if (await verifierAdmin(mur, donnees, req.session) === true) {
					await db.HSET('murs:' + mur, 'ordre', ordre)
					io.to('mur-' + mur).emit('modifierordre', ordre, identifiant)
					req.session.cookie.expires = new Date(Date.now() + dureeSession)
					req.session.save()
				} else {
					socket.emit('nonautorise')
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifierlargeur', async function (mur, largeur, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('identifiant')) { socket.emit('erreur'); return false }
				if (await verifierAdmin(mur, donnees, req.session) === true) {
					await db.HSET('murs:' + mur, 'largeur', largeur)
					io.to('mur-' + mur).emit('modifierlargeur', largeur, identifiant)
					req.session.cookie.expires = new Date(Date.now() + dureeSession)
					req.session.save()
				} else {
					socket.emit('nonautorise')
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifierfond', async function (mur, fond, ancienfond, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('identifiant')) { socket.emit('erreur'); return false }
				if (await verifierAdmin(mur, donnees, req.session) === true) {
					await db.HSET('murs:' + mur, ['fond', fond, 'fondRepete', 'desactive'])
					io.to('mur-' + mur).emit('modifierfond', fond, identifiant)
					if (!ancienfond.includes('/img/') && ancienfond.substring(0, 1) !== '#' && ancienfond !== '') {
						await supprimerFichier(mur, path.basename(ancienfond))
					}
					req.session.cookie.expires = new Date(Date.now() + dureeSession)
					req.session.save()
				} else {
					socket.emit('nonautorise')
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifiercouleurfond', async function (mur, fond, ancienfond, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('identifiant')) { socket.emit('erreur'); return false }
				if (await verifierAdmin(mur, donnees, req.session)) {
					await db.HSET('murs:' + mur, ['fond', fond, 'fondRepete', 'desactive'])
					io.to('mur-' + mur).emit('modifiercouleurfond', fond, identifiant)
					if (!ancienfond.includes('/img/') && ancienfond.substring(0, 1) !== '#' && ancienfond !== '') {
						await supprimerFichier(mur, path.basename(ancienfond))
					}
					req.session.cookie.expires = new Date(Date.now() + dureeSession)
					req.session.save()
				} else {
					socket.emit('nonautorise')
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifierfondrepete', async function (mur, statut, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('identifiant')) { socket.emit('erreur'); return false }
				if (await verifierAdmin(mur, donnees, req.session) === true) {
					await db.HSET('murs:' + mur, 'fondRepete', statut)
					io.to('mur-' + mur).emit('modifierfondrepete', statut)
					req.session.cookie.expires = new Date(Date.now() + dureeSession)
					req.session.save()
				} else {
					socket.emit('nonautorise')
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifieractivite', async function (mur, statut, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('identifiant')) { socket.emit('erreur'); return false }
				if (await verifierAdmin(mur, donnees, req.session) === true) {
					await db.HSET('murs:' + mur, 'registreActivite', statut)
					io.to('mur-' + mur).emit('modifieractivite', statut)
					req.session.cookie.expires = new Date(Date.now() + dureeSession)
					req.session.save()
				} else {
					socket.emit('nonautorise')
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifierconversation', async function (mur, statut, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('identifiant')) { socket.emit('erreur'); return false }
				if (await verifierAdmin(mur, donnees, req.session) === true) {
					await db.HSET('murs:' + mur, 'conversation', statut)
					io.to('mur-' + mur).emit('modifierconversation', statut, identifiant)
					req.session.cookie.expires = new Date(Date.now() + dureeSession)
					req.session.save()
				} else {
					socket.emit('nonautorise')
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifierlisteutilisateurs', async function (mur, statut, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('identifiant')) { socket.emit('erreur'); return false }
				if (await verifierAdmin(mur, donnees, req.session) === true) {
					await db.HSET('murs:' + mur, 'listeUtilisateurs', statut)
					io.to('mur-' + mur).emit('modifierlisteutilisateurs', statut, identifiant)
					req.session.cookie.expires = new Date(Date.now() + dureeSession)
					req.session.save()
				} else {
					socket.emit('nonautorise')
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifiereditionnom', async function (mur, statut, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('identifiant')) { socket.emit('erreur'); return false }
				if (await verifierAdmin(mur, donnees, req.session) === true) {
					await db.HSET('murs:' + mur, 'editionNom', statut)
					io.to('mur-' + mur).emit('modifiereditionnom', statut, identifiant)
					req.session.cookie.expires = new Date(Date.now() + dureeSession)
					req.session.save()
				} else {
					socket.emit('nonautorise')
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifierfichiers', async function (mur, statut, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('identifiant')) { socket.emit('erreur'); return false }
				if (await verifierAdmin(mur, donnees, req.session) === true) {
					await db.HSET('murs:' + mur, 'fichiers', statut)
					io.to('mur-' + mur).emit('modifierfichiers', statut, identifiant)
					req.session.cookie.expires = new Date(Date.now() + dureeSession)
					req.session.save()
				} else {
					socket.emit('nonautorise')
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifierenregistrements', async function (mur, statut, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('identifiant')) { socket.emit('erreur'); return false }
				if (await verifierAdmin(mur, donnees, req.session) === true) {
					await db.HSET('murs:' + mur, 'enregistrements', statut)
					io.to('mur-' + mur).emit('modifierenregistrements', statut, identifiant)
					req.session.cookie.expires = new Date(Date.now() + dureeSession)
					req.session.save()
				} else {
					socket.emit('nonautorise')
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifierliens', async function (mur, statut, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('identifiant')) { socket.emit('erreur'); return false }
				if (await verifierAdmin(mur, donnees, req.session) === true) {
					await db.HSET('murs:' + mur, 'liens', statut)
					io.to('mur-' + mur).emit('modifierliens', statut, identifiant)
					req.session.cookie.expires = new Date(Date.now() + dureeSession)
					req.session.save()
				} else {
					socket.emit('nonautorise')
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifierdocuments', async function (mur, statut, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('identifiant')) { socket.emit('erreur'); return false }
				if (await verifierAdmin(mur, donnees, req.session) === true) {
					await db.HSET('murs:' + mur, 'documents', statut)
					io.to('mur-' + mur).emit('modifierdocuments', statut, identifiant)
					req.session.cookie.expires = new Date(Date.now() + dureeSession)
					req.session.save()
				} else {
					socket.emit('nonautorise')
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifiercommentaires', async function (mur, statut, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('identifiant')) { socket.emit('erreur'); return false }
				if (await verifierAdmin(mur, donnees, req.session) === true) {
					await db.HSET('murs:' + mur, 'commentaires', statut)
					io.to('mur-' + mur).emit('modifiercommentaires', statut, identifiant)
					req.session.cookie.expires = new Date(Date.now() + dureeSession)
					req.session.save()
				} else {
					socket.emit('nonautorise')
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifierevaluations', async function (mur, statut, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('identifiant')) { socket.emit('erreur'); return false }
				if (await verifierAdmin(mur, donnees, req.session) === true) {
					await db.HSET('murs:' + mur, 'evaluations', statut)
					io.to('mur-' + mur).emit('modifierevaluations', statut, identifiant)
					req.session.cookie.expires = new Date(Date.now() + dureeSession)
					req.session.save()
				} else {
					socket.emit('nonautorise')
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifierverrouillage', async function (mur, statut, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('identifiant')) { socket.emit('erreur'); return false }
				if (await verifierAdmin(mur, donnees, req.session) === true) {
					await db.HSET('murs:' + mur, 'verrouillage', statut)
					io.to('mur-' + mur).emit('modifierverrouillage', statut, identifiant)
					req.session.cookie.expires = new Date(Date.now() + dureeSession)
					req.session.save()
				} else {
					socket.emit('nonautorise')
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifierepinglage', async function (mur, statut, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('identifiant')) { socket.emit('erreur'); return false }
				if (await verifierAdmin(mur, donnees, req.session) === true) {
					await db.HSET('murs:' + mur, 'epinglage', statut)
					io.to('mur-' + mur).emit('modifierepinglage', statut, identifiant)
					req.session.cookie.expires = new Date(Date.now() + dureeSession)
					req.session.save()
				} else {
					socket.emit('nonautorise')
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifiercopiebloc', async function (mur, statut, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('identifiant')) { socket.emit('erreur'); return false }
				if (await verifierAdmin(mur, donnees, req.session) === true) {
					await db.HSET('murs:' + mur, 'copieBloc', statut)
					io.to('mur-' + mur).emit('modifiercopiebloc', statut, identifiant)
					req.session.cookie.expires = new Date(Date.now() + dureeSession)
					req.session.save()
				} else {
					socket.emit('nonautorise')
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('messagechat', function (mur, texte, identifiant, nom) {
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				const date = dayjs().format()
				io.to('mur-' + mur).emit('messagechat', { texte: texte, identifiant: identifiant, nom: nom, date: date })
				req.session.cookie.expires = new Date(Date.now() + dureeSession)
				req.session.save()
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('reinitialisermessages', async function (mur, identifiant) {
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('identifiant')) { socket.emit('erreur'); return false }
				if (await verifierAdmin(mur, donnees, req.session) === true) {
					io.to('mur-' + mur).emit('reinitialisermessages', identifiant)
					req.session.cookie.expires = new Date(Date.now() + dureeSession)
					req.session.save()
				} else {
					socket.emit('nonautorise')
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('reinitialiseractivite', async function (mur, identifiant) {
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('identifiant')) { socket.emit('erreur'); return false }
				if (await verifierAdmin(mur, donnees, req.session) === true) {
					await db.UNLINK('activite:' + mur)
					io.to('mur-' + mur).emit('reinitialiseractivite', identifiant)
					req.session.cookie.expires = new Date(Date.now() + dureeSession)
					req.session.save()
				} else {
					socket.emit('nonautorise')
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('ajoutercolonne', async function (mur, titre, colonnes, affichageColonnes, identifiant, nom) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('activite') || !donnees.hasOwnProperty('identifiant')) { socket.emit('erreur'); return false }
				if (await verifierAdmin(mur, donnees, req.session) === true) {
					const date = dayjs().format()
					const activiteId = parseInt(donnees.activite) + 1
					colonnes.push(titre)
					affichageColonnes.push(true)
					await db
					.multi()
					.HSET('murs:' + mur, ['colonnes', JSON.stringify(colonnes), 'affichageColonnes', JSON.stringify(affichageColonnes)])
					// Enregistrer entrée du registre d'activité
					.HINCRBY('murs:' + mur, 'activite', 1)
					.ZADD('activite:' + mur, [{ score: activiteId, value: JSON.stringify({ id: activiteId, identifiant: identifiant, titre: titre, date: date, type: 'colonne-ajoutee' }) }])
					.exec()
					io.to('mur-' + mur).emit('ajoutercolonne', { identifiant: identifiant, nom: nom, titre: titre, colonnes: colonnes, affichageColonnes: affichageColonnes, date: date, activiteId: activiteId })
					req.session.cookie.expires = new Date(Date.now() + dureeSession)
					req.session.save()
				} else {
					socket.emit('nonautorise')
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifiertitrecolonne', async function (mur, titre, index, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('colonnes') || !donnees.hasOwnProperty('identifiant')) { socket.emit('erreur'); return false }
				if (await verifierAdmin(mur, donnees, req.session) === true) {
					const colonnes = JSON.parse(donnees.colonnes)
					colonnes[index] = titre
					await db.HSET('murs:' + mur, 'colonnes', JSON.stringify(colonnes))
					io.to('mur-' + mur).emit('modifiertitrecolonne', colonnes, identifiant)
					req.session.cookie.expires = new Date(Date.now() + dureeSession)
					req.session.save()
				} else {
					socket.emit('nonautorise')
				}
			} else {
				socket.emit('deconnecte')
			}
		})
		
		socket.on('modifieraffichagecolonne', async function (mur, valeur, index, identifiant) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('identifiant')) { socket.emit('erreur'); return false }
				if (await verifierAdmin(mur, donnees, req.session) === true) {
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
					await db.HSET('murs:' + mur, 'affichageColonnes', JSON.stringify(affichageColonnes))
					io.to('mur-' + mur).emit('modifieraffichagecolonne', affichageColonnes, valeur, index, identifiant)
					req.session.cookie.expires = new Date(Date.now() + dureeSession)
					req.session.save()
				} else {
					socket.emit('nonautorise')
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('verifierblocscolonnes', async function (donnees) {
			const mur = donnees.mur
			const identifiant = donnees.identifiant
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null) { socket.emit('erreur'); return false }
				const donneesMur = await recupererDonneesMurProtege(donnees, mur, identifiant)
				socket.emit('verifierblocscolonnes', donneesMur.blocs)
			}
		})

		socket.on('supprimercolonne', async function (mur, titre, colonne, identifiant, nom) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('colonnes') || !donnees.hasOwnProperty('identifiant')) { socket.emit('erreur'); return false }
				if (await verifierAdmin(mur, donnees, req.session) === true) {
					const colonnes = JSON.parse(donnees.colonnes)
					colonnes.splice(colonne, 1)
					const affichageColonnes = JSON.parse(donnees.affichageColonnes)
					affichageColonnes.splice(colonne, 1)
					const donneesBlocs = []
					const blocs = await db.ZRANGE('blocs:' + mur, 0, -1)
					if (blocs === null) { socket.emit('erreur'); return false }
					for (const bloc of blocs) {
						const donneesBloc = new Promise(async function (resolve) {
							let resultat = await db.HGETALL('contenu-blocs:' + mur + ':' + bloc)
							resultat = Object.assign({}, resultat)
							if (resultat === null) { resolve({}); return false }
							resolve(resultat)
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
							const donneesBlocSupprime = new Promise(async function (resolve) {
								const resultat = await db.EXISTS('contenu-blocs:' + mur + ':' + blocSupprime)
								if (resultat === null) { resolve(); return false }
								if (resultat === 1) {
									let objet = await db.HGETALL('contenu-blocs:' + mur + ':' + blocSupprime)
									objet = Object.assign({}, objet)
									if (objet === null) { resolve(); return false }
									if (objet.hasOwnProperty('media') && objet.media !== '' && objet.type !== 'embed' && objet.type !== 'lien') {
										await supprimerFichier(mur, objet.media)
									}
									if (objet.hasOwnProperty('mediaExtra') && objet.mediaExtra !== '') {
										await supprimerFichier(mur, objet.mediaExtra)
									}
									if (objet.hasOwnProperty('medias')) {
										const medias = JSON.parse(objet.medias)
										for (let i = 0; i < medias.length; i++) {
											if (medias[i].hasOwnProperty('fichier')) {
												await supprimerFichier(mur, medias[i].fichier)
											}
										}
									}
									if (objet.hasOwnProperty('vignette') && definirVignettePersonnalisee(objet.vignette) === true) {
										await supprimerFichier(mur, path.basename(objet.vignette))
									}
									if (objet.hasOwnProperty('bloc') && objet.bloc === blocSupprime) {
										await db
										.multi()
										.UNLINK('contenu-blocs:' + mur + ':' + blocSupprime)
										.ZREM('blocs:' + mur, blocSupprime)
										.UNLINK('commentaires:' + blocSupprime)
										.UNLINK('evaluations:' + blocSupprime)
										.exec()
										resolve('supprime')
									} else {
										resolve()
									}
								} else {
									resolve()
								}
							})
							donneesBlocsSupprimes.push(donneesBlocSupprime)
						}
						const donneesBlocsRestants = []
						for (let i = 0; i < blocsRestants.length; i++) {
							const donneeBloc = new Promise(async function (resolve) {
								if (parseInt(blocsRestants[i].colonne) > parseInt(colonne)) {
									await db.HSET('contenu-blocs:' + mur + ':' + blocsRestants[i].bloc, 'colonne', (parseInt(blocsRestants[i].colonne) - 1))
									resolve(i)
								} else {
									resolve(i)
								}
							})
							donneesBlocsRestants.push(donneeBloc)
						}
						Promise.all([donneesBlocsSupprimes, donneesBlocsRestants]).then(async function () {
							const date = dayjs().format()
							const activiteId = parseInt(donnees.activite) + 1
							await db
							.multi()
							.HSET('murs:' + mur, ['colonnes', JSON.stringify(colonnes), 'affichageColonnes', JSON.stringify(affichageColonnes)])
							// Enregistrer entrée du registre d'activité
							.HINCRBY('murs:' + mur, 'activite', 1)
							.ZADD('activite:' + mur, [{ score: activiteId, value: JSON.stringify({ id: activiteId, identifiant: identifiant, titre: titre, date: date, type: 'colonne-supprimee' }) }])
							.exec()
							io.to('mur-' + mur).emit('supprimercolonne', { identifiant: identifiant, nom: nom, titre: titre, colonne: colonne, colonnes: colonnes, affichageColonnes: affichageColonnes, date: date, activiteId: activiteId })
							req.session.cookie.expires = new Date(Date.now() + dureeSession)
							req.session.save()
						})
					})
				} else {
					socket.emit('nonautorise')
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('deplacercolonne', async function (mur, titre, affichage, direction, colonne, identifiant, nom) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('colonnes') || !donnees.hasOwnProperty('identifiant')) { socket.emit('erreur'); return false }
				if (await verifierAdmin(mur, donnees, req.session) === true) {
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
					const blocs = await db.ZRANGE('blocs:' + mur, 0, -1)
					if (blocs === null) { socket.emit('erreur'); return false }
					for (const bloc of blocs) {
						const donneesBloc = new Promise(async function (resolve) {
							let resultat = await db.HGETALL('contenu-blocs:' + mur + ':' + bloc)
							resultat = Object.assign({}, resultat)
							if (resultat === null) { resolve({}); return false }
							resolve(resultat)
						})
						donneesBlocs.push(donneesBloc)
					}
					Promise.all(donneesBlocs).then(async function (items) {
						const donneesBlocsDeplaces = []
						for (const item of items) {
							const donneesBlocDeplace = new Promise(async function (resolve) {
								if (item && item.hasOwnProperty('bloc')) {
									const resultat = await db.EXISTS('contenu-blocs:' + mur + ':' + item.bloc)
									if (resultat === null) { resolve(); return false }
									if (resultat === 1 && parseInt(item.colonne) === parseInt(colonne) && direction === 'gauche') {
										await db.HSET('contenu-blocs:' + mur + ':' + item.bloc, 'colonne', (parseInt(colonne) - 1))
										resolve('deplace')
									} else if (resultat === 1 && parseInt(item.colonne) === parseInt(colonne) && direction === 'droite') {
										await db.HSET('contenu-blocs:' + mur + ':' + item.bloc, 'colonne', (parseInt(colonne) + 1))
										resolve('deplace')
									} else if (resultat === 1 && parseInt(item.colonne) === (parseInt(colonne) - 1) && direction === 'gauche') {
										await db.HSET('contenu-blocs:' + mur + ':' + item.bloc, 'colonne', parseInt(colonne))
										resolve('deplace')
									} else if (resultat === 1 && parseInt(item.colonne) === (parseInt(colonne) + 1) && direction === 'droite') {
										await db.HSET('contenu-blocs:' + mur + ':' + item.bloc, 'colonne', parseInt(colonne))
										resolve('deplace')
									} else {
										resolve()
									}
								} else {
									resolve()
								}
							})
							donneesBlocsDeplaces.push(donneesBlocDeplace)
						}
						Promise.all(donneesBlocsDeplaces).then(async function () {
							const date = dayjs().format()
							const activiteId = parseInt(donnees.activite) + 1
							await db
							.multi()
							.HSET('murs:' + mur, ['colonnes', JSON.stringify(colonnes), 'affichageColonnes', JSON.stringify(affichageColonnes)])
							// Enregistrer entrée du registre d'activité
							.HINCRBY('murs:' + mur, 'activite', 1)
							.ZADD('activite:' + mur, [{ score: activiteId, value: JSON.stringify({ id: activiteId, identifiant: identifiant, titre: titre, date: date, type: 'colonne-deplacee' }) }])
							.exec()
							io.to('mur-' + mur).emit('deplacercolonne', { identifiant: identifiant, nom: nom, titre: titre, direction: direction, colonne: colonne, colonnes: colonnes, affichageColonnes: affichageColonnes, date: date, activiteId: activiteId })
							req.session.cookie.expires = new Date(Date.now() + dureeSession)
							req.session.save()
						})
					})
				} else {
					socket.emit('nonautorise')
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('modifiernotification', async function (mur, admins) {
			if (maintenance === true) {
				socket.emit('maintenance')
				return false
			}
			await db.HSET('murs:' + mur, 'notification', JSON.stringify(admins))
			io.to('mur-' + mur).emit('modifiernotification', admins)
			req.session.cookie.expires = new Date(Date.now() + dureeSession)
			req.session.save()
		})

		socket.on('verifiermodifierbloc', function (mur, bloc, identifiant) {
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				socket.to('mur-' + mur).emit('verifiermodifierbloc', { bloc: bloc, identifiant: identifiant })
				req.session.cookie.expires = new Date(Date.now() + dureeSession)
				req.session.save()
			}
		})

		socket.on('reponsemodifierbloc', function (mur, identifiant, reponse) {
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				socket.to('mur-' + mur).emit('reponsemodifierbloc', { identifiant: identifiant, reponse: reponse })
				req.session.cookie.expires = new Date(Date.now() + dureeSession)
				req.session.save()
			}
		})

		socket.on('supprimeractivite', async function (mur, id, identifiant) {
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				let donnees = await db.HGETALL('murs:' + mur)
				donnees = Object.assign({}, donnees)
				if (donnees === null || !donnees.hasOwnProperty('identifiant')) { socket.emit('erreur'); return false }
				if (await verifierAdmin(mur, donnees, req.session) === true) {
					await db.ZREMRANGEBYSCORE('activite:' + mur, id, id)
					io.to('mur-' + mur).emit('supprimeractivite', id, identifiant)
					req.session.cookie.expires = new Date(Date.now() + dureeSession)
					req.session.save()
				} else {
					socket.emit('nonautorise')
				}
			} else {
				socket.emit('deconnecte')
			}
		})

		socket.on('murimporte', function (mur, identifiant) {
			if (identifiant !== '' && identifiant !== undefined && req.session.identifiant === identifiant) {
				socket.to('mur-' + mur).emit('murimporte')
				req.session.cookie.expires = new Date(Date.now() + dureeSession)
				req.session.save()
			}
		})

		socket.on('modifierlangue', function (langue) {
			req.session.langue = langue
			req.session.save()
		})

		socket.on('verifiermaintenance', function () {
			socket.emit('verifiermaintenance', maintenance)
		})

		socket.on('activermaintenance', function (admin) {
			if (admin !== '' && admin === process.env.ADMIN_PASSWORD) {
				maintenance = true
				socket.emit('verifiermaintenance', true)
			}
		})

		socket.on('desactivermaintenance', function (admin) {
			if (admin !== '' && admin === process.env.ADMIN_PASSWORD) {
				maintenance = false
				socket.emit('verifiermaintenance', false)
			}
		})
	})

	async function creerMur (res, id, token, slug, titre, date, identifiant, destination, donneesUtilisateur) {
		if (id === 1) {
			await db.SET('mur', 1)
		} else {
			await db.INCR('mur')
		}
		await db
		.multi()
		.HSET('murs:' + id, ['id', id, 'token', token, 'titre', titre, 'identifiant', identifiant, 'fond', '/img/fond7.png', 'acces', 'public', 'motdepasseAdmin', '', 'contributions', 'ouvertes', 'affichage', 'mur', 'registreActivite', 'active', 'conversation', 'desactivee', 'listeUtilisateurs', 'activee', 'editionNom', 'desactivee', 'fichiers', 'actives', 'enregistrements', 'desactives', 'liens', 'actives', 'documents', 'desactives', 'commentaires', 'desactives', 'evaluations', 'desactivees', 'verrouillage', 'desactive', 'epinglage', 'desactive', 'copieBloc', 'desactivee', 'ordre', 'croissant', 'largeur', 'normale', 'date', date, 'colonnes', JSON.stringify([]), 'affichageColonnes', JSON.stringify([]), 'bloc', 0, 'activite', 0, 'admins', JSON.stringify([]), 'vues', 0, 'digidrive', 0])
		.SADD('murs-crees:' + identifiant, id.toString())
		.SADD('utilisateurs-murs:' + id, identifiant)
		.HSET('dates-murs:' + id, 'date', date)
		.exec()
		if (stockage === 'fs') {
			const chemin = path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + id)
			await fs.mkdirp(chemin)
		}
		if (destination !== '') {
			const dossiers = JSON.parse(donneesUtilisateur.dossiers)
			dossiers.forEach(function (dossier, indexDossier) {
				if (dossier.id === destination) {
					dossiers[indexDossier].murs.push(id)
				}
			})
			await db.HSET('utilisateurs:' + identifiant, 'dossiers', JSON.stringify(dossiers))
		}
		res.json({ id: id, token: token, slug: slug, titre: titre, identifiant: identifiant, fond: '/img/fond7.png', acces: 'public', motdepasseAdmin: '', contributions: 'ouvertes', affichage: 'mur', registreActivite: 'active', conversation: 'desactivee', listeUtilisateurs: 'activee', editionNom: 'desactivee', fichiers: 'actives', enregistrements: 'desactives', liens: 'actives', documents: 'desactives', commentaires: 'desactives', evaluations: 'desactivees', verrouillage: 'desactive', epinglage: 'desactive', copieBloc: 'desactivee', ordre: 'croissant', largeur: 'normale', date: date, colonnes: [], affichageColonnes: [], bloc: 0, activite: 0, admins: [], vues: 0 })
	}

	async function creerMurSansCompte (req, res, id, token, slug, titre, hash, date, identifiant, nom, langue, type) {
		if (id === 1) {
			await db.SET('mur', 1)
		} else {
			await db.INCR('mur')
		}
		let digidrive = 0
		if (type === 'api') {
			digidrive = 1
		}
		await db
		.multi()
		.HSET('murs:' + id, ['id', id, 'token', token, 'titre', titre, 'identifiant', identifiant, 'motdepasse', hash, 'fond', '/img/fond7.png', 'acces', 'public', 'motdepasseAdmin', '', 'contributions', 'ouvertes', 'affichage', 'mur', 'registreActivite', 'active', 'conversation', 'desactivee', 'listeUtilisateurs', 'activee', 'editionNom', 'desactivee', 'fichiers', 'actives', 'enregistrements', 'desactives', 'liens', 'actives', 'documents', 'desactives', 'commentaires', 'desactives', 'evaluations', 'desactivees', 'verrouillage', 'desactive', 'epinglage', 'desactive', 'copieBloc', 'desactivee', 'ordre', 'croissant', 'largeur', 'normale', 'date', date, 'colonnes', JSON.stringify([]), 'affichageColonnes', JSON.stringify([]), 'bloc', 0, 'activite', 0, 'admins', JSON.stringify([]), 'vues', 0, 'digidrive', digidrive])
		.HSET('utilisateurs:' + identifiant, ['id', identifiant, 'date', date, 'nom', nom, 'langue', langue])
		.exec()
		if (type === 'api') {
			await db.SADD('murs-crees:' + identifiant, id.toString())
		}
		if (stockage === 'fs') {
			const chemin = path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + id)
			await fs.mkdirp(chemin)
		}
		if (type === 'api') {
			res.send(id + '/' + token + '/' + slug)
		} else {
			req.session.langue = langue
			req.session.statut = 'auteur'
			if (!req.session.hasOwnProperty('murs')) {
				req.session.murs = []
			}
			if (!req.session.murs.includes(parseInt(id))) {
				req.session.murs.push(parseInt(id))
			}
			req.session.cookie.expires = new Date(Date.now() + dureeSession)
			res.json({ id: id, token: token, slug: slug })
		}
	}

	function recupererDonneesUtilisateur (identifiant) {
		// Murs créés
		const donneesMursCrees = new Promise(async function (resolveMain) {
			const murs = await db.SMEMBERS('murs-crees:' + identifiant)
			const donneesMurs = []
			if (murs === null) { resolveMain(donneesMurs) }
			for (const mur of murs) {
				const donneeMur = new Promise(async function (resolve) {
					const resultat = await db.EXISTS('murs:' + mur)
					if (resultat === null) { resolve({}); return false }
					if (resultat === 1) {
						let donnees = await db.HGETALL('murs:' + mur)
						donnees = Object.assign({}, donnees)
						if (donnees === null) { resolve({}); return false }
						// Pour compatibilité avec les anciens chemins
						if (donnees.hasOwnProperty('fond') && !donnees.fond.includes('/img/') && donnees.fond.substring(0, 1) !== '#' && donnees.fond !== '' && typeof donnees.fond === 'string') {
							donnees.fond = path.basename(donnees.fond)
						}
						const reponse = await db.EXISTS('utilisateurs:' + donnees.identifiant)
						if (reponse === 1) {
							let utilisateur = await db.HGETALL('utilisateurs:' + donnees.identifiant)
							utilisateur = Object.assign({}, utilisateur)
							if (utilisateur === null) {
								donnees.nom = donnees.identifiant
								resolve(donnees)
								return false
							}
							if (utilisateur.nom === '') {
								donnees.nom = donnees.identifiant
							} else {
								donnees.nom = utilisateur.nom
							}
							resolve(donnees)
						} else {
							donnees.nom = donnees.identifiant
							resolve(donnees)
						}
					} else {
						resolve({})
					}
				})
				donneesMurs.push(donneeMur)
			}
			Promise.all(donneesMurs).then(function (resultat) {
				resolveMain(resultat)
			})
		})
		// Murs supprimés
		const donneesMursSupprimes = new Promise(async function (resolveMain) {
			const murs = await db.SMEMBERS('murs-supprimes:' + identifiant)
			const donneesMurs = []
			if (murs === null) { resolveMain(donneesMurs) }
			for (const mur of murs) {
				const donneeMur = new Promise(async function (resolve) {
					const resultat = await db.EXISTS('murs:' + mur)
					if (resultat === null) { resolve({}); return false }
					if (resultat === 1) {
						let donnees = await db.HGETALL('murs:' + mur)
						donnees = Object.assign({}, donnees)
						if (donnees === null) { resolve({}); return false }
						// Pour compatibilité avec les anciens chemins
						if (donnees.hasOwnProperty('fond') && !donnees.fond.includes('/img/') && donnees.fond.substring(0, 1) !== '#' && donnees.fond !== '' && typeof donnees.fond === 'string') {
							donnees.fond = path.basename(donnees.fond)
						}
						const reponse = await db.EXISTS('utilisateurs:' + donnees.identifiant)
						if (reponse === 1) {
							let utilisateur = await db.HGETALL('utilisateurs:' + donnees.identifiant)
							utilisateur = Object.assign({}, utilisateur)
							if (utilisateur === null) {
								donnees.nom = donnees.identifiant
								resolve(donnees)
								return false
							}
							if (utilisateur.nom === '') {
								donnees.nom = donnees.identifiant
							} else {
								donnees.nom = utilisateur.nom
							}
							resolve(donnees)
						} else {
							donnees.nom = donnees.identifiant
							resolve(donnees)
						}
					} else {
						resolve({})
					}
				})
				donneesMurs.push(donneeMur)
			}
			Promise.all(donneesMurs).then(function (resultat) {
				resolveMain(resultat)
			})
		})
		// Murs rejoints
		const donneesMursRejoints = new Promise(async function (resolveMain) {
			const murs = await db.SMEMBERS('murs-rejoints:' + identifiant)
			const donneesMurs = []
			if (murs === null) { resolveMain(donneesMurs); return false }
			for (const mur of murs) {
				const donneeMur = new Promise(async function (resolve) {
					const resultat = await db.EXISTS('murs:' + mur)
					if (resultat === null) { resolve({}); return false }
					if (resultat === 1) {
						let donnees = await db.HGETALL('murs:' + mur)
						donnees = Object.assign({}, donnees)
						if (donnees === null) { resolve({}); return false }
						// Pour compatibilité avec les anciens chemins
						if (donnees.hasOwnProperty('fond') && !donnees.fond.includes('/img/') && donnees.fond.substring(0, 1) !== '#' && donnees.fond !== '' && typeof donnees.fond === 'string') {
							donnees.fond = path.basename(donnees.fond)
						}
						const reponse = await db.EXISTS('utilisateurs:' + donnees.identifiant)
						if (reponse === 1) {
							let utilisateur = await db.HGETALL('utilisateurs:' + donnees.identifiant)
							utilisateur = Object.assign({}, utilisateur)
							if (utilisateur === null) {
								donnees.nom = donnees.identifiant
								resolve(donnees)
								return false
							}
							if (utilisateur.nom === '') {
								donnees.nom = donnees.identifiant
							} else {
								donnees.nom = utilisateur.nom
							}
							resolve(donnees)
						} else {
							donnees.nom = donnees.identifiant
							resolve(donnees)
						}
					} else {
						resolve({})
					}
				})
				donneesMurs.push(donneeMur)
			}
			Promise.all(donneesMurs).then(function (resultat) {
				resolveMain(resultat)
			})
		})
		// Murs administrés
		const donneesMursAdmins = new Promise(async function (resolveMain) {
			const murs = await db.SMEMBERS('murs-admins:' + identifiant)
			const donneesMurs = []
			if (murs === null) { resolveMain(donneesMurs) }
			for (const mur of murs) {
				const donneeMur = new Promise(async function (resolve) {
					const resultat = await db.EXISTS('murs:' + mur)
					if (resultat === null) { resolve({}); return false }
					if (resultat === 1) {
						let donnees = await db.HGETALL('murs:' + mur)
						donnees = Object.assign({}, donnees)
						if (donnees === null) { resolve({}); return false }
						// Pour compatibilité avec les anciens chemins
						if (donnees.hasOwnProperty('fond') && !donnees.fond.includes('/img/') && donnees.fond.substring(0, 1) !== '#' && donnees.fond !== '' && typeof donnees.fond === 'string') {
							donnees.fond = path.basename(donnees.fond)
						}
						const reponse = await db.EXISTS('utilisateurs:' + donnees.identifiant)
						if (reponse === 1) {
							let utilisateur = await db.HGETALL('utilisateurs:' + donnees.identifiant)
							utilisateur = Object.assign({}, utilisateur)
							if (utilisateur === null) {
								donnees.nom = donnees.identifiant
								resolve(donnees)
								return false
							}
							if (utilisateur.nom === '') {
								donnees.nom = donnees.identifiant
							} else {
								donnees.nom = utilisateur.nom
							}
							resolve(donnees)
						} else {
							donnees.nom = donnees.identifiant
							resolve(donnees)
						}
					} else {
						resolve({})
					}
				})
				donneesMurs.push(donneeMur)
			}
			Promise.all(donneesMurs).then(function (resultat) {
				resolveMain(resultat)
			})
		})
		// Murs favoris
		const donneesMursFavoris = new Promise(async function (resolveMain) {
			const murs = await db.SMEMBERS('murs-favoris:' + identifiant)
			const donneesMurs = []
			if (murs === null) { resolveMain(donneesMurs) }
			for (const mur of murs) {
				const donneeMur = new Promise(async function (resolve) {
					const resultat = await db.EXISTS('murs:' + mur)
					if (resultat === null) { resolve({}); return false }
					if (resultat === 1) {
						let donnees = await db.HGETALL('murs:' + mur)
						donnees = Object.assign({}, donnees)
						if (donnees === null) { resolve({}); return false }
						// Pour compatibilité avec les anciens chemins
						if (donnees.hasOwnProperty('fond') && !donnees.fond.includes('/img/') && donnees.fond.substring(0, 1) !== '#' && donnees.fond !== '' && typeof donnees.fond === 'string') {
							donnees.fond = path.basename(donnees.fond)
						}
						const reponse = await db.EXISTS('utilisateurs:' + donnees.identifiant)
						if (reponse === 1) {
							let utilisateur = await db.HGETALL('utilisateurs:' + donnees.identifiant)
							utilisateur = Object.assign({}, utilisateur)
							if (utilisateur === null) {
								donnees.nom = donnees.identifiant
								resolve(donnees)
								return false
							}
							if (utilisateur.nom === '') {
								donnees.nom = donnees.identifiant
							} else {
								donnees.nom = utilisateur.nom
							}
							resolve(donnees)
						} else {
							donnees.nom = donnees.identifiant
							resolve(donnees)
						}
					} else {
						resolve({})
					}
				})
				donneesMurs.push(donneeMur)
			}
			Promise.all(donneesMurs).then(function (resultat) {
				resolveMain(resultat)
			})
		})
		return Promise.all([donneesMursCrees, donneesMursSupprimes, donneesMursRejoints, donneesMursAdmins, donneesMursFavoris])
	}

	function recupererDonneesAuteur (identifiant) {
		// Murs créés
		const donneesMursCrees = new Promise(async function (resolveMain) {
			const murs = await db.SMEMBERS('murs-crees:' + identifiant)
			const donneesMurs = []
			if (murs === null) { resolveMain(donneesMurs); return false }
			for (const mur of murs) {
				const donneeMur = new Promise(async function (resolve) {
					const resultat = await db.EXISTS('murs:' + mur)
					if (resultat === null) { resolve({}); return false }
					if (resultat === 1) {
						let donnees = await db.HGETALL('murs:' + mur)
						donnees = Object.assign({}, donnees)
						if (donnees === null) { resolve({}); return false }
						resolve(donnees)
					} else {
						resolve({})
					}
				})
				donneesMurs.push(donneeMur)
			}
			Promise.all(donneesMurs).then(function (resultat) {
				resolveMain(resultat)
			})
		})
		// Murs administrés
		const donneesMursAdmins = new Promise(async function (resolveMain) {
			const murs = await db.SMEMBERS('murs-admins:' + identifiant)
			const donneesMurs = []
			if (murs === null) { resolveMain(donneesMurs); return false }
			for (const mur of murs) {
				const donneeMur = new Promise(async function (resolve) {
					const resultat = await db.EXISTS('murs:' + mur)
					if (resultat === null) { resolve({}); return false }
					if (resultat === 1) {
						let donnees = await db.HGETALL('murs:' + mur)
						donnees = Object.assign({}, donnees)
						if (donnees === null) { resolve({}); return false }
						resolve(donnees)
					} else {
						resolve({})
					}
				})
				donneesMurs.push(donneeMur)
			}
			Promise.all(donneesMurs).then(function (resultat) {
				resolveMain(resultat)
			})
		})
		return Promise.all([donneesMursCrees, donneesMursAdmins])
	}

	async function recupererDonneesMur (id, token, identifiant, statut, murs, res) {
		let mur = await db.HGETALL('murs:' + id)
		mur = Object.assign({}, mur)
		if (mur !== null && mur.hasOwnProperty('id') && mur.id === id && mur.hasOwnProperty('token') && mur.token === token) {
			mur.admins = JSON.parse(mur.admins)
			// Vérifier si admin
			let admin = false
			if ((statut === 'utilisateur' && (mur.admins.includes(identifiant) || mur.identifiant === identifiant)) || (statut === 'auteur' && murs && murs.includes(parseInt(id)))) {
				admin = true
			}
			// Vérifier accès
			let accesCode = false
			if (mur.hasOwnProperty('code') && mur.acces === 'code') {
				accesCode = true
			}
			let accesPrive = false
			if (mur.acces === 'prive') {
				accesPrive = true
			}
			const nombreColonnes = JSON.parse(mur.colonnes).length
			mur.colonnes = JSON.parse(mur.colonnes)
			if (mur.hasOwnProperty('notification')) {
				mur.notification = JSON.parse(mur.notification)
			}
			const slug = definirSlug(mur.titre)
			mur.slug = slug
			let vues = parseInt(mur.vues)
			if (!admin && !accesPrive) {
				vues = vues + 1
			}
			if (!mur.hasOwnProperty('digidrive')) {
				mur.digidrive = 0
			}
			mur.affichageColonnes = JSON.parse(mur.affichageColonnes)
			if (!mur.hasOwnProperty('epinglage')) {
				mur.epinglage = 'desactive'
			}
			if (!mur.hasOwnProperty('fondRepete')) {
				mur.fondRepete = 'desactive'
			}
			// Pour compatibilité avec les anciens chemins
			if (mur.hasOwnProperty('fond') && !mur.fond.includes('/img/') && mur.fond.substring(0, 1) !== '#' && mur.fond !== '' && typeof mur.fond === 'string') {
				mur.fond = path.basename(mur.fond)
			}
			// Cacher mots de passe front
			if (mur.hasOwnProperty('motdepasse')) {
				mur.motdepasse = ''
			}
			if (!admin && mur.hasOwnProperty('motdepasseAdmin')) {
				mur.motdepasseAdmin = ''
			}
			// Cacher données front
			if (!admin) {
				if (accesCode) {
					mur.code = ''
				}
				if (accesCode || accesPrive) {
					mur.colonnes = []
					mur.affichageColonnes = []
				}
				mur.admins = []
			}
			const blocsMur = new Promise(async function (resolveMain) {
				const donneesBlocs = []
				if (admin || (!accesCode && !accesPrive)) {
					const blocs = await db.ZRANGE('blocs:' + id, 0, -1)
					if (blocs === null) { resolveMain(donneesBlocs); return false }
					for (const bloc of blocs) {
						const donneesBloc = new Promise(async function (resolve) {
							let donnees = await db.HGETALL('contenu-blocs:' + id + ':' + bloc)
							donnees = Object.assign({}, donnees)
							if (donnees === null) { resolve({}); return false }
							if (Object.keys(donnees).length > 0) {
								// Pour résoudre le problème des capsules qui sont référencées dans une colonne inexistante
								if (parseInt(donnees.colonne) >= nombreColonnes) {
									donnees.colonne = nombreColonnes - 1
								}
								// Pour compatibilité avec les anciens chemins
								if (donnees.hasOwnProperty('vignette') && definirVignettePersonnalisee(donnees.vignette) === true) {
									donnees.vignette = path.basename(donnees.vignette)
								}
								donnees.medias = JSON.parse(donnees.medias)
								if (!donnees.hasOwnProperty('motdepasse')) {
									donnees.motdepasse = ''
								}
								if (!donnees.hasOwnProperty('epinglee')) {
									donnees.epinglee = 'non'
								}
								// Ne pas ajouter les capsules en attente de modération ou privées
								if (((mur.contributions === 'moderees' && donnees.visibilite === 'masquee') || donnees.visibilite === 'privee') && donnees.identifiant !== identifiant && !admin) {
									resolve({})
									return false
								}
								// Ne pas ajouter les capsules dans les colonnes masquées
								if (mur.affichage === 'colonnes' && mur.affichageColonnes[donnees.colonne] === false && mur.identifiant !== identifiant && !admin) {
									resolve({})
									return false
								}
								const commentaires = await db.ZCARD('commentaires:' + bloc)
								if (commentaires === null) {
									donnees.commentaires = []
									resolve(donnees)
									return false
								}
								donnees.commentaires = commentaires
								const evaluations = await db.ZRANGE('evaluations:' + bloc, 0, -1)
								if (evaluations === null) {
									donnees.evaluations = []
									resolve(donnees)
									return false
								}
								const donneesEvaluations = []
								evaluations.forEach(function (evaluation) {
									donneesEvaluations.push(JSON.parse(evaluation))
								})
								donnees.evaluations = donneesEvaluations
								const resultat = await db.EXISTS('utilisateurs:' + donnees.identifiant)
								if (resultat === null) {
									donnees.nom = ''
									resolve(donnees)
									return false
								}
								if (resultat === 1) {
									let utilisateur = await db.HGETALL('utilisateurs:' + donnees.identifiant)
									utilisateur = Object.assign({}, utilisateur)
									if (utilisateur === null) {
										donnees.nom = ''
										resolve(donnees)
										return false
									}
									donnees.nom = utilisateur.nom
									resolve(donnees)
								} else {
									const reponse = await db.EXISTS('noms:' + donnees.identifiant)
									if (reponse === 1) {
										const nom = await db.HGET('noms:' + donnees.identifiant, 'nom')
										if (nom === null) {
											donnees.nom = ''
											resolve(donnees)
											return false
										}
										donnees.nom = nom
										resolve(donnees)
									} else {
										donnees.nom = ''
										resolve(donnees)
									}
								}
							} else {
								resolve({})
							}
						})
						donneesBlocs.push(donneesBloc)
					}
					Promise.all(donneesBlocs).then(function (resultat) {
						resultat = resultat.filter(function (element) {
							return Object.keys(element).length > 0
						})
						resolveMain(resultat)
					})
				} else {
					resolveMain(donneesBlocs)
				}
			})
			const activiteMur = new Promise(async function (resolveMain) {
				const donneesEntrees = []
				if (admin || (!accesCode && !accesPrive)) {
					const entrees = await db.ZRANGE('activite:' + id, 0, -1)
					if (entrees === null) { resolveMain(donneesEntrees); return false }
					for (let entree of entrees) {
						entree = JSON.parse(entree)
						const donneesEntree = new Promise(async function (resolve) {
							const resultat = await db.EXISTS('utilisateurs:' + entree.identifiant)
							if (resultat === null) {
								entree.nom = ''
								resolve(entree)
								return false
							}
							if (resultat === 1) {
								let utilisateur = await db.HGETALL('utilisateurs:' + entree.identifiant)
								utilisateur = Object.assign({}, utilisateur)
								if (utilisateur === null) {
									entree.nom = ''
									resolve(entree)
									return false
								}
								entree.nom = utilisateur.nom
								resolve(entree)
							} else {
								const reponse = await db.EXISTS('noms:' + entree.identifiant)
								if (reponse === 1) {
									const nom = await db.HGET('noms:' + entree.identifiant, 'nom')
									if (nom === null) { resolve({}) }
									entree.nom = nom
									resolve(entree)
									return false
								} else {
									entree.nom = ''
									resolve(entree)
								}
							}
						})
						donneesEntrees.push(donneesEntree)
					}
					Promise.all(donneesEntrees).then(function (resultat) {
						resolveMain(resultat)
					})
				} else {
					resolveMain(donneesEntrees)
				}
			})
			Promise.all([blocsMur, activiteMur]).then(async function ([blocs, activite]) {
				if (mur.ordre === 'decroissant') {
					blocs.reverse()
				}
				const listeBlocs = []
				// Vérifier capsules épinglées
				const blocsEpingles = []
				blocs.forEach(function (item, index) {
					listeBlocs.push(item.bloc)
					if (item.epinglee === 'oui') {
						blocsEpingles.push(item)
						blocs.splice(index, 1)
					}
					// Filtrer HTML
					let html = item.texte
					html = v.stripTags(html, ['b', 'i', 'u', 'strike', 'a', 'br', 'div', 'font', 'ul', 'ol', 'li'])
					html = html.replace(/style=".*?"/mg, '')
					html = html.replace(/class=".*?"/mg, '')
					item.texte = html
				})
				blocs.unshift(...blocsEpingles)
				// Filtrer activité
				activite = activite.filter(function (element) {
					return Object.keys(element).length > 0 && ((element.hasOwnProperty('type') && element.type.includes('colonne')) || (element.hasOwnProperty('bloc') && listeBlocs.includes(element.bloc)))
				})
				// Ajouter nombre de vues
				await db.HSET('murs:' + id, 'vues', vues)
				// Ajouter dans murs rejoints
				if (mur.identifiant !== identifiant && statut === 'utilisateur') {
					const mursRejoints = await db.SMEMBERS('murs-rejoints:' + identifiant)
					if (mursRejoints === null) { res.send('erreur'); return false }
					let murDejaRejoint = false
					for (const murRejoint of mursRejoints) {
						if (murRejoint === id) {
							murDejaRejoint = true
						}
					}
					if (murDejaRejoint === false && mur.acces !== 'prive') {
						await db
						.multi()
						.SADD('murs-rejoints:' + identifiant, id.toString())
						.SADD('murs-utilisateurs:' + identifiant, id.toString())
						.SADD('utilisateurs-murs:' + id, identifiant)
						.exec()
						res.json({ mur: mur, blocs: blocs, activite: activite.reverse() })
					} else {
						// Vérifier notification mise à jour mur
						if (mur.hasOwnProperty('notification') && mur.notification.includes(identifiant) && Array.isArray(mur.notification)) {
							mur.notification.splice(mur.notification.indexOf(identifiant), 1)
							await db.HSET('murs:' + id, 'notification', JSON.stringify(mur.notification))
							res.json({ mur: mur, blocs: blocs, activite: activite.reverse() })
						} else {
							res.json({ mur: mur, blocs: blocs, activite: activite.reverse() })
						}
					}
				} else {
					// Vérifier notification mise à jour mur
					if (mur.hasOwnProperty('notification') && mur.notification.includes(identifiant) && Array.isArray(mur.notification)) {
						mur.notification.splice(mur.notification.indexOf(identifiant), 1)
						await db.HSET('murs:' + id, 'notification', JSON.stringify(mur.notification))
						res.json({ mur: mur, blocs: blocs, activite: activite.reverse() })
					} else {
						res.json({ mur: mur, blocs: blocs, activite: activite.reverse() })
					}
				}
			})
		} else {
			res.send('erreur')
		}
	}

	async function recupererDonneesMurProtege (mur, id, identifiant) {
		return new Promise(function (resolveData) {
			const nombreColonnes = JSON.parse(mur.colonnes).length
			mur.colonnes = JSON.parse(mur.colonnes)
			if (mur.hasOwnProperty('notification')) {
				mur.notification = JSON.parse(mur.notification)
			}
			mur.affichageColonnes = JSON.parse(mur.affichageColonnes)
			const blocsMur = new Promise(async function (resolveMain) {
				const donneesBlocs = []
				const blocs = await db.ZRANGE('blocs:' + id, 0, -1)
				if (blocs === null) { resolveMain(donneesBlocs); return false }
				for (const bloc of blocs) {
					const donneesBloc = new Promise(async function (resolve) {
						let donnees = await db.HGETALL('contenu-blocs:' + id + ':' + bloc)
						donnees = Object.assign({}, donnees)
						if (donnees === null) { resolve({}); return false }
						if (Object.keys(donnees).length > 0) {
							// Pour résoudre le problème des capsules qui sont référencées dans une colonne inexistante
							if (parseInt(donnees.colonne) >= nombreColonnes) {
								donnees.colonne = nombreColonnes - 1
							}
							// Pour compatibilité avec les anciens chemins
							if (donnees.hasOwnProperty('vignette') && definirVignettePersonnalisee(donnees.vignette) === true) {
								donnees.vignette = path.basename(donnees.vignette)
							}
							donnees.medias = JSON.parse(donnees.medias)
							if (!donnees.hasOwnProperty('motdepasse')) {
								donnees.motdepasse = ''
							}
							if (!donnees.hasOwnProperty('epinglee')) {
								donnees.epinglee = 'non'
							}
							// Ne pas ajouter les capsules en attente de modération ou privées
							if (((mur.contributions === 'moderees' && donnees.visibilite === 'masquee') || donnees.visibilite === 'privee') && donnees.identifiant !== identifiant) {
								resolve({})
								return false
							}
							// Ne pas ajouter les capsules dans les colonnes masquées
							if (mur.affichage === 'colonnes' && mur.affichageColonnes[donnees.colonne] === false) {
								resolve({})
								return false
							}
							const commentaires = await db.ZCARD('commentaires:' + bloc)
							if (commentaires === null) {
								donnees.commentaires = []
								resolve(donnees)
								return false
							}
							donnees.commentaires = commentaires
							const evaluations = await db.ZRANGE('evaluations:' + bloc, 0, -1)
							if (evaluations === null) {
								donnees.evaluations = []
								resolve(donnees)
								return false
							}
							const donneesEvaluations = []
							evaluations.forEach(function (evaluation) {
								donneesEvaluations.push(JSON.parse(evaluation))
							})
							donnees.evaluations = donneesEvaluations
							const resultat = await db.EXISTS('utilisateurs:' + donnees.identifiant)
							if (resultat === null) {
								donnees.nom = ''
								resolve(donnees)
								return false
							}
							if (resultat === 1) {
								let utilisateur = await db.HGETALL('utilisateurs:' + donnees.identifiant)
								utilisateur = Object.assign({}, utilisateur)
								if (utilisateur === null) {
									donnees.nom = ''
									resolve(donnees)
									return false
								}
								donnees.nom = utilisateur.nom
								resolve(donnees)
							} else {
								const reponse = await db.EXISTS('noms:' + donnees.identifiant)
								if (reponse === 1) {
									const nom = await db.HGET('noms:' + donnees.identifiant, 'nom')
									if (nom === null) {
										donnees.nom = ''
										resolve(donnees)
										return false
									}
									donnees.nom = nom
									resolve(donnees)
								} else {
									donnees.nom = ''
									resolve(donnees)
								}
							}
						} else {
							resolve({})
						}
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
			const activiteMur = new Promise(async function (resolveMain) {
				const donneesEntrees = []
				const entrees = await db.ZRANGE('activite:' + id, 0, -1)
				if (entrees === null) { resolveMain(donneesEntrees); return false }
				for (let entree of entrees) {
					entree = JSON.parse(entree)
					const donneesEntree = new Promise(async function (resolve) {
						const resultat = await db.EXISTS('utilisateurs:' + entree.identifiant)
						if (resultat === null) {
							entree.nom = ''
							resolve(entree)
							return false
						}
						if (resultat === 1) {
							let utilisateur = await db.HGETALL('utilisateurs:' + entree.identifiant)
							utilisateur = Object.assign({}, utilisateur)
							if (utilisateur === null) {
								entree.nom = ''
								resolve(entree)
								return false
							}
							entree.nom = utilisateur.nom
							resolve(entree)
						} else {
							const reponse = await db.EXISTS('noms:' + entree.identifiant)
							if (reponse === 1) {
								const nom = await db.HGET('noms:' + entree.identifiant, 'nom')
								if (nom === null) { resolve({}) }
								entree.nom = nom
								resolve(entree)
								return false
							} else {
								entree.nom = ''
								resolve(entree)
							}
						}
					})
					donneesEntrees.push(donneesEntree)
				}
				Promise.all(donneesEntrees).then(function (resultat) {
					resolveMain(resultat)
				})
			})
			Promise.all([blocsMur, activiteMur]).then(async function ([blocs, activite]) {
				if (mur.ordre === 'decroissant') {
					blocs.reverse()
				}
				const listeBlocs = []
				// Vérifier capsules épinglées
				const blocsEpingles = []
				blocs.forEach(function (item, index) {
					listeBlocs.push(item.bloc)
					if (item.epinglee === 'oui') {
						blocsEpingles.push(item)
						blocs.splice(index, 1)
					}
					// Filtrer HTML
					let html = item.texte
					html = v.stripTags(html, ['b', 'i', 'u', 'strike', 'a', 'br', 'div', 'font', 'ul', 'ol', 'li'])
					html = html.replace(/style=".*?"/mg, '')
					html = html.replace(/class=".*?"/mg, '')
					item.texte = html
				})
				blocs.unshift(...blocsEpingles)
				// Filtrer activité
				activite = activite.filter(function (element) {
					return Object.keys(element).length > 0 && ((element.hasOwnProperty('type') && element.type.includes('colonne')) || (element.hasOwnProperty('bloc') && listeBlocs.includes(element.bloc)))
				})
				// Vérifier notification mise à jour mur
				if (mur.hasOwnProperty('notification') && mur.notification.includes(identifiant) && Array.isArray(mur.notification)) {
					mur.notification.splice(mur.notification.indexOf(identifiant), 1)
					await db.HSET('murs:' + id, 'notification', JSON.stringify(mur.notification))
					resolveData({ mur: mur, blocs: blocs, activite: activite.reverse() })
				} else {
					resolveData({ mur: mur, blocs: blocs, activite: activite.reverse() })
				}
			})
		})
	}

	async function verifierAcces (mur, identifiant, motdepasse) {
		return new Promise(async function (resolve) {
			let donnees = await db.HGETALL('murs:' + mur)
			donnees = Object.assign({}, donnees)
			if (donnees === null || !donnees.hasOwnProperty('identifiant')) { resolve({ acces: 'erreur', utilisateur: {} }); return false }
			if (identifiant === donnees.identifiant && motdepasse.trim() !== '' && donnees.hasOwnProperty('motdepasse') && donnees.motdepasse.trim() !== '' && await bcrypt.compare(motdepasse, donnees.motdepasse)) {
				let utilisateur = await db.HGETALL('utilisateurs:' + identifiant)
				utilisateur = Object.assign({}, utilisateur)
				if (utilisateur === null || !utilisateur.hasOwnProperty('id') || !utilisateur.hasOwnProperty('nom') || !utilisateur.hasOwnProperty('langue')) { resolve({ acces: 'erreur', utilisateur: {} }); return false }
				if (!donnees.hasOwnProperty('digidrive') || (donnees.hasOwnProperty('digidrive') && parseInt(donnees.digidrive) === 0)) {
					await db.HSET('murs:' + mur, 'digidrive', 1)
				}
				resolve({ acces: 'mur_debloque', utilisateur: utilisateur })
			} else if (identifiant === donnees.identifiant && !donnees.hasOwnProperty('motdepasse')) {
				const resultat = await db.EXISTS('utilisateurs:' + identifiant)
				if (resultat === null) { resolve({ acces: 'erreur', utilisateur: {} }); return false }
				if (resultat === 1) {
					let utilisateur = await db.HGETALL('utilisateurs:' + identifiant)
					utilisateur = Object.assign({}, utilisateur)
					if (utilisateur === null || !utilisateur.hasOwnProperty('id') || !utilisateur.hasOwnProperty('motdepasse') || !utilisateur.hasOwnProperty('nom') || !utilisateur.hasOwnProperty('langue')) { resolve({ acces: 'erreur', utilisateur: {} }); return false }
					if (motdepasse.trim() !== '' && utilisateur.hasOwnProperty('motdepasse') && utilisateur.motdepasse.trim() !== '' && await bcrypt.compare(motdepasse, utilisateur.motdepasse)) {
						if (!donnees.hasOwnProperty('digidrive') || (donnees.hasOwnProperty('digidrive') && parseInt(donnees.digidrive) === 0)) {
							await db.HSET('murs:' + mur, 'digidrive', 1)
						}
						resolve({ acces: 'mur_debloque', utilisateur: utilisateur })
					} else {
						resolve({ acces: 'erreur', utilisateur: {} })
					}
				} else {
					resolve({ acces: 'erreur', utilisateur: {} })
				}
			} else {
				resolve({ acces: 'erreur', utilisateur: {} })
			}
		})
	}

	function exporterMur (req, res, id, erreur) {
		const donneesMur = new Promise(async function (resolveMain) {
			let resultats = await db.HGETALL('murs:' + id)
			resultats = Object.assign({}, resultats)
			if (resultats === null) { resolveMain({}); return false }
			resolveMain(resultats)
		})
		const blocsMur = new Promise(async function (resolveMain) {
			const donneesBlocs = []
			const blocs = await db.ZRANGE('blocs:' + id, 0, -1)
			if (blocs === null) { resolveMain(donneesBlocs); return false }
			for (const bloc of blocs) {
				const donneesBloc = new Promise(async function (resolve) {
					let donnees = await db.HGETALL('contenu-blocs:' + id + ':' + bloc)
					donnees = Object.assign({}, donnees)
					if (donnees === null) { resolve({}); return false }
					const donneesCommentaires = []
					const commentaires = await db.ZRANGE('commentaires:' + bloc, 0, -1)
					if (commentaires === null) { resolve(donnees); return false }
					for (let commentaire of commentaires) {
						donneesCommentaires.push(JSON.parse(commentaire))
					}
					donnees.commentaires = donneesCommentaires.length
					donnees.listeCommentaires = donneesCommentaires
					const evaluations = await db.ZRANGE('evaluations:' + bloc, 0, -1)
					if (evaluations === null) { resolve(donnees); return false }
					const donneesEvaluations = []
					evaluations.forEach(function (evaluation) {
						donneesEvaluations.push(JSON.parse(evaluation))
					})
					donnees.evaluations = donneesEvaluations.length
					donnees.listeEvaluations = donneesEvaluations
					const reponse = await db.EXISTS('noms:' + donnees.identifiant)
					if (reponse === null) { resolve(donnees); return false }
					if (reponse === 1) {
						const nom = await db.HGET('noms:' + donnees.identifiant, 'nom')
						if (nom === null) { resolve(donnees); return false }
						donnees.nom = nom
						donnees.info = formaterDate(donnees, req.session.langue)
						resolve(donnees)
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
				donneesBlocs.push(donneesBloc)
			}
			Promise.all(donneesBlocs).then(function (resultat) {
				resultat = resultat.filter(function (element) {
					return Object.keys(element).length > 0
				})
				resolveMain(resultat)
			})
		})
		const activiteMur = new Promise(async function (resolveMain) {
			const donneesEntrees = []
			const entrees = await db.ZRANGE('activite:' + id, 0, -1)
			if (entrees === null) { resolveMain(donneesEntrees) }
			for (let entree of entrees) {
				entree = JSON.parse(entree)
				const donneesEntree = new Promise(async function (resolve) {
					const resultat = await db.EXISTS('utilisateurs:' + entree.identifiant)
					if (resultat === null) { resolve({}) }
					if (resultat === 1) {
						resolve(entree)
					} else {
						resolve({})
					}
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
				if (!parametres.mur.fond.includes('/img/') && parametres.mur.fond.substring(0, 1) !== '#' && parametres.mur.fond !== '') {
					const fichierFond = path.basename(parametres.mur.fond)
					if (stockage === 'fs' && await fs.pathExists(path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + id + '/' + fichierFond))) {
						await fs.copy(path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + id + '/' + path.basename(parametres.mur.fond)), path.normalize(chemin + '/' + id + '/fichiers/' + fichierFond, { overwrite: true }))
					} else if (stockage === 's3') {
						try {
							const fichierMeta = await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: id + '/' + fichierFond }))
							if (fichierMeta.hasOwnProperty('ContentLength')) {
								await telechargerFichierS3(id + '/' + fichierFond, path.normalize(chemin + '/' + id + '/fichiers/' + fichierFond))
							}
						} catch (e) {}
					}
				} else if (parametres.mur.fond.includes('/img/') && await fs.pathExists(path.join(__dirname, '..', '/public' + parametres.mur.fond))) {
					await fs.copy(path.join(__dirname, '..', '/public' + parametres.mur.fond), path.normalize(chemin + '/' + id + '/static' + parametres.mur.fond, { overwrite: true }))
				}
				if (await fs.pathExists(path.join(__dirname, '..', '/static/export/css'))) {
					await fs.copy(path.join(__dirname, '..', '/static/export/css'), path.normalize(chemin + '/' + id + '/static/css'))
				}
				if (await fs.pathExists(path.join(__dirname, '..', '/static/export/js'))) {
					await fs.copy(path.join(__dirname, '..', '/static/export/js'), path.normalize(chemin + '/' + id + '/static/js'))
				}
				await fs.copy(path.join(__dirname, '..', '/public/fonts/MaterialIcons-Regular.woff2'), path.normalize(chemin + '/' + id + '/static/fonts/MaterialIcons-Regular.woff2'))
				await fs.copy(path.join(__dirname, '..', '/public/fonts/Roboto-Slab-Medium.woff2'), path.normalize(chemin + '/' + id + '/static/fonts/Roboto-Slab-Medium.woff2'))
				await fs.copy(path.join(__dirname, '..', '/public/img/favicon.png'), path.normalize(chemin + '/' + id + '/static/img/favicon.png'))
				for (const bloc of parametres.blocs) {
					if (stockage === 'fs' && Object.keys(bloc).length > 0 && bloc.hasOwnProperty('media') && bloc.media !== '' && bloc.type !== 'embed' && bloc.type !== 'lien' && await fs.pathExists(path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + id + '/' + bloc.media))) {
						await fs.copy(path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + id + '/' + bloc.media), path.normalize(chemin + '/' + id + '/fichiers/' + bloc.media, { overwrite: true }))
					} else if (stockage === 's3' && Object.keys(bloc).length > 0 && bloc.hasOwnProperty('media') && bloc.media !== '' && bloc.type !== 'embed' && bloc.type !== 'lien') {
						try {
							const fichierMeta = await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: id + '/' + bloc.media }))
							if (fichierMeta.hasOwnProperty('ContentLength')) {
								await telechargerFichierS3(id + '/' + bloc.media, path.normalize(chemin + '/' + id + '/fichiers/' + bloc.media))
							}
						} catch (e) {}
					}
					if (stockage === 'fs' && Object.keys(bloc).length > 0 && bloc.hasOwnProperty('mediaExtra') && bloc.mediaExtra !== '' && await fs.pathExists(path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + id + '/' + bloc.mediaExtra))) {
						await fs.copy(path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + id + '/' + bloc.mediaExtra), path.normalize(chemin + '/' + id + '/fichiers/' + bloc.mediaExtra, { overwrite: true }))
					} else if (stockage === 's3' && Object.keys(bloc).length > 0 && bloc.hasOwnProperty('mediaExtra') && bloc.mediaExtra !== '') {
						try {
							const fichierMeta = await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: id + '/' + bloc.mediaExtra }))
							if (fichierMeta.hasOwnProperty('ContentLength')) {
								await telechargerFichierS3(id + '/' + bloc.mediaExtra, path.normalize(chemin + '/' + id + '/fichiers/' + bloc.mediaExtra))
							}
						} catch (e) {}
					}
					if (Object.keys(bloc).length > 0 && bloc.hasOwnProperty('medias')) {
						const medias = JSON.parse(bloc.medias)
						for (let i = 0; i < medias.length; i++) {
							if (stockage === 'fs' && medias[i].fichier !== '' && await fs.pathExists(path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + id + '/' + medias[i].fichier))) {
								await fs.copyFile(path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + id + '/' + medias[i].fichier), path.normalize(chemin + '/' + id + '/fichiers/' + medias[i].fichier, { overwrite: true }))
							} else if (stockage === 's3' && medias[i].fichier !== '') {
								try {
									const fichierMeta = await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: id + '/' + medias[i].fichier }))
									if (fichierMeta.hasOwnProperty('ContentLength')) {
										await telechargerFichierS3(id + '/' + medias[i].fichier, path.normalize(chemin + '/' + id + '/fichiers/' + medias[i].fichier))
									}
								} catch (e) {}
							}
						}
					}
					if (Object.keys(bloc).length > 0 && bloc.hasOwnProperty('vignette') && bloc.vignette !== '') {
						if (typeof bloc.vignette === 'string' && bloc.vignette.includes('/img/') && !verifierURL(bloc.vignette, ['https', 'http']) && await fs.pathExists(path.join(__dirname, '..', '/public' + bloc.vignette))) {
							await fs.copy(path.join(__dirname, '..', '/public' + bloc.vignette), path.normalize(chemin + '/' + id + '/static' + bloc.vignette, { overwrite: true }))
						} else if (typeof bloc.vignette === 'string' && !verifierURL(bloc.vignette, ['https', 'http'])) {
							const fichierVignette = path.basename(bloc.vignette)
							if (stockage === 'fs' && await fs.pathExists(path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + id + '/' + fichierVignette))) {
								await fs.copy(path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + id + '/' + fichierVignette), path.normalize(chemin + '/' + id + '/fichiers/' + fichierVignette, { overwrite: true }))
							} else if (stockage === 's3') {
								try {
									const fichierMeta = await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: id + '/' + fichierVignette }))
									if (fichierMeta.hasOwnProperty('ContentLength')) {
										await telechargerFichierS3(id + '/' + fichierVignette, path.normalize(chemin + '/' + id + '/fichiers/' + fichierVignette))
									}
								} catch (e) {}
							}
						}
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
				res.send(erreur)
			}
		})
	}

	async function fetchSockets (room) {
		for (let i = 0; i < 5; i++) {
			try {
				return await io.in(room).fetchSockets()
			} catch (e) {}
		}
	}

	async function verifierAdmin (mur, donnees, session) {
		return new Promise(async function (resolve) {
			if (session.hasOwnProperty('identifiant') && session.hasOwnProperty('statut') && session.statut === 'utilisateur' && session.hasOwnProperty('motdepasse')) {
				const proprietaire = donnees.identifiant
				let admins = []
				if (donnees.hasOwnProperty('admins')) {
					admins = donnees.admins
				}
				let donneesUtilisateur = await db.HGETALL('utilisateurs:' + session.identifiant)
				donneesUtilisateur = Object.assign({}, donneesUtilisateur)
				if (donneesUtilisateur === null || !donneesUtilisateur.hasOwnProperty('motdepasse')) { resolve('erreur'); return false }
				if ((proprietaire === session.identifiant || admins.includes(session.identifiant)) && await bcrypt.compare(session.motdepasse, donneesUtilisateur.motdepasse)) {
					resolve(true)
				} else {
					resolve(false)
				}
			} else if (session.hasOwnProperty('statut') && session.statut === 'auteur' && session.hasOwnProperty('murs') && session.murs.includes(parseInt(mur))) {
				resolve(true)
			} else {
				resolve(false)
			}
		})
	}

	async function verifierAdminUtilisateur (mur, identifiant, motdepasse) {
		return new Promise(async function (resolve) {
			let donneesMur = await db.HGETALL('murs:' + mur)
			donneesMur = Object.assign({}, donneesMur)
			if (donneesMur === null) { resolve('erreur'); return false }
			let admins = []
			if (donneesMur.hasOwnProperty('admins')) {
				admins = donneesMur.admins
			}
			let donneesUtilisateur = await db.HGETALL('utilisateurs:' + identifiant)
			donneesUtilisateur = Object.assign({}, donneesUtilisateur)
			if (donneesUtilisateur === null || !donneesUtilisateur.hasOwnProperty('motdepasse')) { resolve('erreur'); return false }
			if ((donneesMur.identifiant === identifiant || admins.includes(identifiant)) && await bcrypt.compare(motdepasse, donneesUtilisateur.motdepasse)) {
				resolve(true)
			} else {
				resolve(false)
			}
		})
	}

	function supprimerSession (req) {
		if (req.hasOwnProperty('session')) {
			req.session.identifiant = ''
			req.session.motdepasse = ''
			req.session.nom = ''
			req.session.email = ''
			req.session.langue = ''
			req.session.statut = ''
			req.session.destroy()
		}
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
		const caracteres = '123456789abcdefghijklmnopqrstuvwxyz'.split('')
		const caracteresSpeciaux = '!#$@*'
		const specialRegex = /[!#\$@*]/
		const majuscules = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
		const majusculesRegex = /[A-Z]/

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

	function definirNomFichier (fichier) {
		const info = path.parse(fichier)
		const extension = info.ext.toLowerCase()
		let nom = v.latinise(info.name.toLowerCase())
		nom = nom.replace(/\ /gi, '-')
		nom = nom.replace(/[^0-9a-z_\-]/gi, '')
		if (nom.length > 100) {
			nom = nom.substring(0, 100)
		}
		nom = nom + '_' + Math.random().toString(36).substring(2) + extension
		return nom
	}

	function definirVignettePersonnalisee (vignette) {
		if (vignette !== '' && typeof vignette === 'string' && !vignette.includes('/img/') && !verifierURL(vignette, ['https', 'http'])) {
			return true
		} else {
			return false
		}
	}

	function definirCheminFichiers () {
		if (process.env.VITE_STORAGE && process.env.VITE_STORAGE === 's3' && process.env.VITE_S3_PUBLIC_LINK && process.env.VITE_S3_PUBLIC_LINK !== '') {
			return process.env.VITE_S3_PUBLIC_LINK
		} else {
			return '/fichiers'
		}
	}

	function definirSlug (titre) {
		let slug = v.latinise(titre.toLowerCase())
		slug = slug.replace(/\ /gi, '-')
		slug = slug.replace(/[^0-9a-z_\-]/gi, '')
		return slug
	}

	async function telechargerFichierS3 (cle, fichier) {
		return new Promise(async function (resolve) {
			const donnees = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: cle }))
			const writeStream = fs.createWriteStream(fichier)
			donnees.Body.pipe(writeStream)
			writeStream.on('finish', function () {
				resolve('termine')
			})
			writeStream.on('error', function () {
				resolve('erreur')
			})
		})
	}

	async function supprimerFichier (mur, fichier) {
		return new Promise(async function (resolve) {
			if (stockage === 'fs' && fichier !== '') {
				const chemin = path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + mur + '/' + fichier)
				if (await fs.pathExists(chemin)) {
					await fs.remove(chemin)
				}
			} else if (stockage === 's3' && fichier !== '') {
				await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: mur + '/' + fichier }))
			}
			resolve()
		})
	}

	const televerser = multer({
		storage: multer.diskStorage({
			destination: function (req, fichier, callback) {
				const mur = req.body.mur
				const chemin = path.join(__dirname, '..', '/static' + definirCheminFichiers() + '/' + mur + '/')
				callback(null, chemin)
			},
			filename: function (req, fichier, callback) {
				const nom = definirNomFichier(fichier.originalname)
				callback(null, nom)
			}
		}),
		fileFilter: function (req, fichier, callback) {
			if (req.body.mur) {
				const dossier = path.join(__dirname, '..', '/static' + definirCheminFichiers())
				checkDiskSpace(dossier).then(function (diskSpace) {
					const espace = Math.round((diskSpace.free / diskSpace.size) * 100)
					if (espace < minimumEspaceDisque) {
						callback('erreur_espace_disque')
					} else {
						callback(null, true)
					}
				})
			} else {
				callback(null, true)
			}
		}
	}).single('fichier')

	const televerserTemp = multer({
		storage: multer.diskStorage({
			destination: function (req, fichier, callback) {
				const chemin = path.join(__dirname, '..', '/static/temp/')
				callback(null, chemin)
			},
			filename: function (req, fichier, callback) {
				const nom = definirNomFichier(fichier.originalname)
				callback(null, nom)
			}
		}),
		fileFilter: function (req, fichier, callback) {
			if (req.body.mur) {
				const dossier = path.join(__dirname, '..', '/static' + definirCheminFichiers())
				checkDiskSpace(dossier).then(function (diskSpace) {
					const espace = Math.round((diskSpace.free / diskSpace.size) * 100)
					if (espace < minimumEspaceDisque) {
						callback('erreur_espace_disque')
					} else {
						callback(null, true)
					}
				})
			} else {
				callback(null, true)
			}
		}
	}).single('fichier')

	function verifierURL (s, protocoles) {
		try {
			const url = new URL(s)
			return protocoles ? url.protocol ? protocoles.map(x => `${x.toLowerCase()}:`).includes(url.protocol) : false : true
		} catch (err) {
			return false
		}
	}

	function verifierJSON (json){
		try {
			const o = JSON.parse(json)
			if (o && typeof o === 'object') {
				return o
			}
		}
		catch (e) { }
		return false
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
		case 'de':
			if (donnees.hasOwnProperty('modifie')) {
				dateFormattee = 'Erstellt am ' + dayjs(new Date(donnees.date)).locale('de').format('L') + ' um ' + dayjs(new Date(donnees.date)).locale('de').format('LT') + ' von ' + donnees.nom + '. Geändert am ' + dayjs(new Date(donnees.modifie)).locale('de').format('L') + ' um ' + dayjs(new Date(donnees.modifie)).locale('de').format('LT') + '.'
			} else {
				dateFormattee = 'Erstellt am ' + dayjs(new Date(donnees.date)).locale('de').format('L') + ' um ' + dayjs(new Date(donnees.date)).locale('de').format('LT') + ' von ' + donnees.nom + '.'
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

						<div id="mur" :class="{'fond-personnalise': mur.fond.substring(0, 1) !== '#' && !mur.fond.includes('/img/') && (!mur.hasOwnProperty('fondRepete') || mur.fondRepete === 'desactive'), 'fond-personnalise-repete': mur.fond.substring(0, 1) !== '#' && !mur.fond.includes('/img/') && mur.hasOwnProperty('fondRepete') && mur.fondRepete === 'active'}" :style="definirFond(mur.fond)" v-if="!chargement">
							<!-- Affichage mur -->
							<masonry id="blocs" class="mur" :cols="definirLargeurCapsules()" :gutter="0" v-if="mur.affichage === 'mur'">
								<div :id="item.bloc" class="bloc" v-for="(item, indexItem) in blocs" :style="{'border-color': item.couleur}" :data-bloc="item.bloc" :key="'bloc' + indexItem">
									<div class="contenu">
										<div class="titre" v-if="item.titre !== ''" :style="{'background': eclaircirCouleur(item.couleur)}">
											<span>{{ item.titre }}</span>
										</div>
										<div class="texte" v-if="item.texte !== ''" v-html="item.texte"></div>
										<div class="media" :class="{'iframe-video': item.type === 'embed' && item.vignetteActivee === 'non' && (item.source === 'digiview' || item.source === 'peertube' || item.source === 'youtube' || item.source === 'vimeo' || item.source === 'dailymotion' || item.source === 'soundcloud')}" v-if="item.media !== '' || item.medias.length > 0">
											<img role="button" tabindex="0" v-if="item.type === 'image' || item.typeBloc === 'image-audio'" :src="'./fichiers/' + item.media" @click="afficherVisionneuse(item)" @keydown.enter="afficherVisionneuse(item)">
											<img role="button" tabindex="0" v-else-if="item.type === 'lien-image'" :src="item.media" @click="afficherVisionneuse(item)" @keydown.enter="afficherVisionneuse(item)">
											<audio v-else-if="item.type === 'audio' && item.vignetteActivee === 'non'" controls preload="metadata" :src="'./fichiers/' + item.media"></audio>
											<video v-else-if="item.type === 'video' && item.vignetteActivee === 'non'" controls playsinline crossOrigin="anonymous" :src="'./fichiers/' + item.media"></video>
											<iframe v-else-if="item.type === 'embed' && item.vignetteActivee === 'non' && (item.source === 'digiview' || item.source === 'peertube' || item.source === 'youtube' || item.source === 'vimeo' || item.source === 'dailymotion' || item.source === 'soundcloud')" :src="item.iframe" allowfullscreen></iframe>
											<span role="button" tabindex="0" v-else-if="item.type === 'audio' || item.type === 'video' || item.type === 'embed' || item.typeBloc === 'galerie'" @click="afficherVisionneuse(item)" @keydown.enter="afficherVisionneuse(item)"><img :class="{'vignette': definirVignette(item).substring(0, 9) !== './static/'}" :src="definirVignette(item)"></span>
											<span role="button" tabindex="0" v-else-if="item.type === 'document' || item.type === 'pdf' || item.type === 'office'" @click="afficherMedia(item)" @keydown.enter="afficherMedia(item)"><img :class="{'vignette': definirVignette(item).substring(0, 9) !== './static/'}" :src="definirVignette(item)"></span>
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
											<span role="button" tabindex="0" class="bouton" @click="ouvrirModaleCommentaires(item.bloc, item.titre)" @keydown.enter="ouvrirModaleCommentaires(item.bloc, item.titre)" v-if="mur.commentaires === 'actives'"><i class="material-icons">comment</i><span class="badge">{{ item.commentaires }}</span></span>
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
											<img role="button" tabindex="0" v-if="item.type === 'image' || item.typeBloc === 'image-audio'" :src="'./fichiers/' + item.media" @click="afficherVisionneuse(item)" @keydown.enter="afficherVisionneuse(item)">
											<img role="button" tabindex="0" v-else-if="item.type === 'lien-image'" :src="item.media" @click="afficherVisionneuse(item)" @keydown.enter="afficherVisionneuse(item)">
											<audio v-else-if="item.type === 'audio' && item.vignetteActivee === 'non'" controls preload="metadata" :src="'./fichiers/' + item.media"></audio>
											<video v-else-if="item.type === 'video' && item.vignetteActivee === 'non'" controls playsinline crossOrigin="anonymous" :src="'./fichiers/' + item.media"></video>
											<iframe v-else-if="item.type === 'embed' && item.vignetteActivee === 'non' && (item.source === 'digiview' || item.source === 'peertube' || item.source === 'youtube' || item.source === 'vimeo' || item.source === 'dailymotion' || item.source === 'soundcloud')" :src="item.iframe" allowfullscreen></iframe>
											<span role="button" tabindex="0" v-else-if="item.type === 'audio' || item.type === 'video' || item.type === 'embed' || item.typeBloc === 'galerie'" @click="afficherVisionneuse(item)" @keydown.enter="afficherVisionneuse(item)"><img :class="{'vignette': definirVignette(item).substring(0, 9) !== './static/'}" :src="definirVignette(item)"></span>
											<span role="button" tabindex="0" v-else-if="item.type === 'document' || item.type === 'pdf' || item.type === 'office'" @click="afficherMedia(item)" @keydown.enter="afficherMedia(item)"><img :class="{'vignette': definirVignette(item).substring(0, 9) !== './static/'}" :src="definirVignette(item)"></span>
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
											<span role="button" tabindex="0" class="bouton" @click="ouvrirModaleCommentaires(item.bloc, item.titre)" @keydown.enter="ouvrirModaleCommentaires(item.bloc, item.titre)" v-if="mur.commentaires === 'actives'"><i class="material-icons">comment</i><span class="badge">{{ item.commentaires }}</span></span>
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
													<img role="button" tabindex="0" v-if="item.type === 'image' || item.typeBloc === 'image-audio'" :src="'./fichiers/' + item.media" @click="afficherVisionneuse(item)" @keydown.enter="afficherVisionneuse(item)">
													<img role="button" tabindex="0" v-else-if="item.type === 'lien-image'" :src="item.media" @click="afficherVisionneuse(item)" @keydown.enter="afficherVisionneuse(item)">
													<audio v-else-if="item.type === 'audio' && item.vignetteActivee === 'non'" controls preload="metadata" :src="'./fichiers/' + item.media"></audio>
													<video v-else-if="item.type === 'video' && item.vignetteActivee === 'non'" controls playsinline crossOrigin="anonymous" :src="'./fichiers/' + item.media"></video>
													<iframe v-else-if="item.type === 'embed' && item.vignetteActivee === 'non' && (item.source === 'digiview' || item.source === 'peertube' || item.source === 'youtube' || item.source === 'vimeo' || item.source === 'dailymotion' || item.source === 'soundcloud')" :src="item.iframe" allowfullscreen></iframe>
													<span role="button" tabindex="0" v-else-if="item.type === 'audio' || item.type === 'video' || item.type === 'embed' || item.typeBloc === 'galerie'" @click="afficherVisionneuse(item)" @keydown.enter="afficherVisionneuse(item)"><img :class="{'vignette': definirVignette(item).substring(0, 9) !== './static/'}" :src="definirVignette(item)"></span>
													<span role="button" tabindex="0" v-else-if="item.type === 'document' || item.type === 'pdf' || item.type === 'office'" @click="afficherMedia(item)" @keydown.enter="afficherMedia(item)"><img :class="{'vignette': definirVignette(item).substring(0, 9) !== './static/'}" :src="definirVignette(item)"></span>
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
													<span role="button" tabindex="0" class="bouton" @click="ouvrirModaleCommentaires(item.bloc)" @keydown.enter="ouvrirModaleCommentaires(item.bloc)" v-if="mur.commentaires === 'actives'"><i class="material-icons">comment</i><span class="badge">{{ item.commentaires }}</span></span>
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
							<div id="discussion" class="modale" role="dialog">
								<div class="en-tete">
									<span class="titre">{{ titre }}</span>
									<span role="button" tabindex="0" class="fermer" @click="fermerModaleCommentaires" @keydown.enter="fermerModaleCommentaires"><i class="material-icons">close</i></span>
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
									this.$nextTick(function () {
										document.querySelector('.modale .fermer').focus()
									})
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
								if (item.vignette && item.vignette !== '' && this.verifierURL(item.vignette) === false && String(item.vignette).includes('/img/')) {
									vignette = './static/img/' + item.vignette.split('/').pop()
								} else if (item.vignette && item.vignette !== '' && this.verifierURL(item.vignette) === false && !String(item.vignette).includes('/img/')) {
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
