/**
 * PublishableNodes
 *
 * Contains the currently publishable (proxy) nodes.
 */
define(
[
	'emberjs',
	'Library/jquery-with-dependencies',
	'vie/instance',
	'vie/entity',
	'Shared/EventDispatcher',
	'Shared/Notification'
], function(
	Ember,
	$,
	vie,
	EntityWrapper,
	EventDispatcher,
	Notification
) {
	return Ember.Object.extend({
		publishableEntitySubjects: [],

		workspaceWidePublishableEntitySubjects: [],

		noChanges: function() {
			return this.get('publishableEntitySubjects').length === 0;
		}.property('publishableEntitySubjects.length'),

		numberOfPublishableNodes: function() {
			return this.get('publishableEntitySubjects').length;
		}.property('publishableEntitySubjects.length'),

		noWorkspaceWideChanges: function() {
			return this.get('workspaceWidePublishableEntitySubjects').length === 0;
		}.property('workspaceWidePublishableEntitySubjects.length'),

		numberOfWorkspaceWidePublishableNodes: function() {
			return this.get('workspaceWidePublishableEntitySubjects').length;
		}.property('workspaceWidePublishableEntitySubjects.length'),

		initialize: function() {
			vie.entities.on('change', this._updatePublishableEntities, this);
			this._updatePublishableEntities();
		},

		_updatePublishableEntities: function() {
			var publishableEntitySubjects = [];
			var pageNodeContextPath = $('#neos-page-metainformation').attr('about'),
				pageNodePath = pageNodeContextPath.substr(0, pageNodeContextPath.lastIndexOf('@'));

			vie.entities.forEach(function(entity) {
				if (this._isEntityPublishable(entity)) {
					var nodePath = entity.id.substr(1, entity.id.lastIndexOf('@') - 1);

					if (!this.get('workspaceWidePublishableEntitySubjects').findBy('nodePath', nodePath)) {
						this.get('workspaceWidePublishableEntitySubjects').addObject({
							nodePath: nodePath,
							pageNodePath: pageNodePath
						});
					}
					publishableEntitySubjects.push(entity.id);
				}
			}, this);

			this.set('publishableEntitySubjects', publishableEntitySubjects);
		},

		/**
		 * Check whether the entity is publishable or not. Currently, everything
		 * which is not in the live workspace is publishable.
		 */
		_isEntityPublishable: function(entity) {
			var attributes = EntityWrapper.extractAttributesFromVieEntity(entity);
			return attributes.__workspacename !== 'live';
		},

		/**
		 * Publish all blocks which are unsaved *and* on current page.
		 */
		publishChanges: function() {
			var that = this;
			T3.Content.Controller.ServerConnection.sendAllToServer(
				this.get('publishableEntitySubjects'),
				function(subject) {
					var entity = vie.entities.get(subject);
					return [entity.fromReference(subject), 'live'];
				},
				TYPO3_Neos_Service_ExtDirect_V1_Controller_WorkspaceController.publishNode,
				null,
				function(subject) {
					var entity = vie.entities.get(subject);
					entity.set('typo3:__workspacename', 'live');

					var nodePath = entity.id.substr(1, entity.id.lastIndexOf('@') - 1),
						node = that.get('workspaceWidePublishableEntitySubjects').findBy('nodePath', nodePath);
					if (node) {
						that.get('workspaceWidePublishableEntitySubjects').removeObject(node);
					}
				}
			);
		},

		/**
		 * Publishes everything inside the current workspace.
		 */
		publishAll: function() {
			var siteRoot = $('#neos-page-metainformation').attr('data-__siteroot'),
				workspaceName = siteRoot.substr(siteRoot.lastIndexOf('@') + 1),
				publishableEntities = this.get('publishableEntitySubjects'),
				that = this;
			TYPO3_Neos_Service_ExtDirect_V1_Controller_WorkspaceController.publishAll(workspaceName, function(result) {
				if (typeof result !== 'undefined' && result !== null && result.success === true) {
					$.each(publishableEntities, function(index, element) {
						vie.entities.get(element).set('typo3:__workspacename', 'live');
					});

					that.getWorkspaceWideUnpublishedNodes();
				} else {
					Notification.error('Unexpected error while publishing all changes: ' + JSON.stringify(result));
				}
			});
		},

		/**
		 * Get all unpublished nodes inside the current workspace.
		 */
		getWorkspaceWideUnpublishedNodes: function() {
			var siteRoot = $('#neos-page-metainformation').attr('data-__siteroot'),
				workspaceName = siteRoot.substr(siteRoot.lastIndexOf('@') + 1),
				that = this;
			if (typeof TYPO3_Neos_Service_ExtDirect_V1_Controller_WorkspaceController !== 'undefined') {
				TYPO3_Neos_Service_ExtDirect_V1_Controller_WorkspaceController.getWorkspaceWideUnpublishedNodes(workspaceName, function(result) {
					that.set('workspaceWidePublishableEntitySubjects', result.data);
				});
			}
		}
	}).create();
});