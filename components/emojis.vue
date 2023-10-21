<template>
	<div id="emojis" :class="definirClasses()">
		<h5>{{ $t('emoticones') }}</h5>
		<div class="categorie">
			<span v-for="(emoticone, indexEmoticone) in emoticones" @click="insererEmoji(emoticone)" :key="'emoticone_' + indexEmoticone">{{ emoticone }}</span>
		</div>
		<h5>{{ $t('gestesEtCorps') }}</h5>
		<div class="categorie">
			<span v-for="(geste, indexGeste) in gestes" @click="insererEmoji(geste)" :key="'geste_' + indexGeste">{{ geste }}</span>
		</div>
		<h5>{{ $t('nature') }}</h5>
		<div class="categorie">
			<span v-for="(nature, indexNature) in natures" @click="insererEmoji(nature)" :key="'nature_' + indexNature">{{ nature }}</span>
		</div>
		<h5>{{ $t('aliments') }}</h5>
		<div class="categorie">
			<span v-for="(aliment, indexAliment) in aliments" @click="insererEmoji(aliment)" :key="'aliment_' + indexAliment">{{ aliment }}</span>
		</div>
		<h5>{{ $t('objets') }}</h5>
		<div class="categorie">
			<span v-for="(objet, indexObjet) in objets" @click="insererEmoji(objet)" :key="'objet_' + indexObjet">{{ objet }}</span>
		</div>
		<h5>{{ $t('lieux') }}</h5>
		<div class="categorie">
			<span v-for="(lieu, indexLieu) in lieux" @click="insererEmoji(lieu)" :key="'lieu_' + indexLieu">{{ lieu }}</span>
		</div>
	</div>
</template>

<script>
export default {
	name: 'Emojis',
	props: {
		type: String,
		modale: String
	},
	data () {
		return {
			// eslint-disable-next-line
			emoticones: ['😀','😃','😄','😁','😆','😅','😂','🤣','🥲','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥸','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑','🤠','🤡','👻','💀','👽','👾','🤖','🎃','😺','😸','😹','😻','😼','😽','🙀','😿','😾', '💯', '✔️', '☀️', '✨', '🎉'],
			// eslint-disable-next-line
			gestes: ['👋','🤚','✋','👌','🤌','🤏','🤞','🤟','🤘','🤙','👈','👉','👆','👇','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','💅','🤳','💪','🦾','🦵','🦿','🦶','👣','👂','🦻','👃','🫀','🫁','🧠','🦷','🦴','👀','👅','👄','💋','🩸'],
			// eslint-disable-next-line
			natures: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻','🐨','🐯','🦁','🐮','🐷','🐽','🐸','🐵','🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🐣','🐥','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🪱','🐛','🦋','🐌','🐞','🐜','🪰','🪲','🪳','🦟','🦗','🕷','🕸','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🦧','🦣','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🦬','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐕','🦺','🐈','🪶','🐓','🦃','🦤','🦚','🦜','🦢','🦩','🐇','🦝','🦨','🦡','🦫','🦦','🦥','🐁','🐀','🐿','🦔','🐾','🐉','🐲','🌵','🎄','🌲','🌳','🌴','🪵','🌱','🌿','🍀','🎍','🪴','🎋','🍃','🍂','🍁','🍄','🐚','🪨','🌾','💐','🌷','🌹','🥀','🌺','🌸','🌼','🌻','🌞','🌝','🌛','🌜','🌚','🌕','🌖','🌗','🌘','🌑','🌒','🌓','🌔','🌙','🌎','🌍','🌏','🪐','💫','⭐','🌟','✨','💥','🔥','🌈','⛅','⛄','💨','💧','💦','🌊'],
			// eslint-disable-next-line
			aliments: ['🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🫑','🌽','🥕','🫒','🧄','🧅','🥔','🍠','🥐','🥯','🍞','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕','🫓','🥪','🥙','🧆','🌮','🌯','🫔','🥗','🥘','🫕','🥫','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥠','🥮','🍢','🍡','🍧','🍨','🍦','🥧','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯','🥛','🍼','🫖','🍵','🧃','🥤','🧋','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉','🍾','🧊','🥄','🍴','🥣','🥡','🥢','🧂'],
			// eslint-disable-next-line
			objets: ['🎍','💝','🎎','🎒','🎓','🎏','🎆','🎇','🎐','🎑','🎃','👻','🎅','🎄','🎁','🎋','🎉','🎊','🎈','🎌','🔮','🎥','📷','📹','📼','💿','📀','💽','💾','💻','📱','📞','📟','📠','📡','📺','📻','🔊','🔔','📢','📣','⏳','⌛','⏰','⌚','🔓','🔒','🔏','🔐','🔑','🔎','💡','🔦','🔌','🔋','🔍','🛀','🚽','🔧','🔩','🔨','🚪','🚬','💣','🔫','🔪','💊','💉','💰','💴','💵','💳','💸','📲','📧','📥','📤','📩','📨','📫','📪','📮','📦','📝','📄','📃','📑','📊','📈','📉','📜','📋','📅','📆','📇','📁','📂','📌','📎','📏','📐','📕','📗','📘','📙','📓','📔','📒','📚','📖','🔖','📛','📰','🎨','🎬','🎤','🎧','🎼','🎵','🎶','🎹','🎻','🎺','🎷','🎸','👾','🎮','🃏','🎴','🀄','🎲','🎯','🏈','🏀','⚽','⚾','🎾','🎱','🎳','⛳','🏁','🏆','🎿','🏂','🏊','🏄','🎣','🍵','🍶', '👑'],
			// eslint-disable-next-line
			lieux: ['🏠','🏡','🏫','🏢','🏣','🏥','🏦','🏪','🏩','🏨','💒','⛪','🏬','🌇','🌆','🏯','🏰','⛺','🏭','🗼','🗾','🗻','🌄','🌅','🌃','🗽','🌉','🎠','🎡','⛲','🎢','🚢','⛵','🚤','🚀','💺','🚉','🚄','🚅','🚇','🚃','🚌','🚙','🚗','🚕','🚚','🚨','🚓','🚒','🚑','🚲','💈','🚏','🎫','🚥','🚧','🔰','⛽','🏮','🎰','🗿','🎪','🎭','📍','🚩']
		}
	},
	methods: {
		definirClasses () {
			if (this.modale === 'diaporama') {
				return this.type + ' diaporama'
			} else {
				return this.type
			}
		},
		insererEmoji (emoji) {
			this.$emit('emoji', emoji)
		}
	}
}
</script>

<style scoped>
#emojis {
	position: absolute;
	height: 17.2rem;
    width: 30rem;
	padding: 1rem;
	border: 1px solid #ddd;
	background: #fff;
	box-shadow: 0px 0px 8px 3px rgba(0, 0, 0, 0.2);
	overflow: auto;
	-webkit-overflow-scrolling: touch;
	z-index: 10;
	line-height: 1.25;
}

#emojis.commentaire {
	bottom: 12rem;
	left: 1rem;
}

#emojis.commentaire.diaporama {
	left: -1px;
}

#emojis.commentaire-modifie {
	top: 11.5rem;
	left: -1px;
}

#emojis h5 {
	margin: 0 0 2px 0;
	text-transform: uppercase;
	font-size: 1rem;
	cursor: default;
}

.categorie {
	display: flex;
	flex-wrap: wrap;
	justify-content: space-between;
	width: 100%;
	margin-bottom: 1rem;
}

.categorie:last-of-type {
	margin-bottom: 0;
}

.categorie:after {
	content: '';
	flex: auto;
}

.categorie span {
	font-size: 2rem;
	padding: 2px;
	cursor: pointer;
	border-radius: 0.5rem;
}

.categorie span:hover {
	background: #ececec;
	cursor: pointer;
}
</style>
