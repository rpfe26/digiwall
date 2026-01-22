<template>
	<div id="conteneur-message" class="conteneur-modale">
		<div id="message" class="modale" role="dialog">
			<div class="conteneur">
				<div class="contenu">
					<div class="message" v-html="message" />
					<div class="actions">
						<span class="bouton" role="button" tabindex="0" @click="$emit('fermer')" @keydown.enter="$emit('fermer')">{{ $t('fermer') }}</span>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script>
export default {
	name: 'Message',
	props: {
		message: String
	},
	mounted () {
		if (message !== '') {
			this.$emit('elementPrecedent', document.activeElement || document.body)
			this.$nextTick(function () {
				document.querySelector('#message .bouton').focus()
			})
		}
	}
}
</script>

<style>
#conteneur-message .modale .conteneur {
	height: 100%;
	padding: 30px 25px;
	text-align: center;
}

#conteneur-message .modale {
	max-width: 500px;
}

#conteneur-message .message {
	font-size: 18px;
	line-height: 1.5;
}

#conteneur-message .bouton {
	margin-top: 20px;
}

#conteneur-message .modale .actions {
	font-size: 0;
}

#conteneur-message .modale .actions span {
	min-width: 70px;
}
</style>
