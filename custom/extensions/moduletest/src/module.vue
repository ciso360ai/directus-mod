<template>
	<private-view title="My Custom Module">
		Content goes here...
	<input type=button id="testx" @click="tour.start();" value="ccc">
		
		</private-view>
</template>

<script>

  import Shepherd  from 'shepherd.js'

		const tour = new Shepherd.Tour({
			useModalOverlay: true,
			defaultStepOptions: {
			  classes: 'shadow-md bg-purple-dark',
			  scrollTo: true
			}
		  });

		  tour.addStep({
			id: 'tour-step-1',
			text: 'Welcome! Click next for the app tour',
			attachTo: {
				element: '#testx',
				on: 'top'
			  },
			buttons: [
			  {
				text: 'Next',
				action: tour.next
			  }
			]
		  });

		  tour.addStep({
			id: 'tour-step-2',
			text: 'First, a bit of intro',
			buttons: [
			  {
				text: 'Next',
				action: tour.next
			  }
			]
		  });

		  tour.start();

export default {};
</script>
