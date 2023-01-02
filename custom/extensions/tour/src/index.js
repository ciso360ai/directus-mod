export default ({ embed }, { env }) => {
	// Tour of the app
	embed(
		'head',
		'<script src="https://cdnjs.cloudflare.com/ajax/libs/shepherd.js/11.0.1/js/shepherd.min.js" integrity="sha512-TpfSb4OAUaETX8uPvA1AMsPmJQK+deMNkK0+EZ/vZg91KHSm9dxfynnC0StGzFADMJftzCWll0/7USvjy83NRQ==" crossorigin="anonymous" referrerpolicy="no-referrer"></script><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/shepherd.js/11.0.1/css/shepherd.css" integrity="sha512-Nt4iMiqRumUbivLZoP7YOWEI5unLFL7vgncYCX/PnzAyXSceWf1o6sPIgwuIiWfMyXSHLQt0+UwD2nKBheiSVQ==" crossorigin="anonymous" referrerpolicy="no-referrer" />'
	);

	embed(
		'body',
		() => `<script>
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
				element: '#sidebar',
				on: 'left'
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

	  </script>`
	);
};