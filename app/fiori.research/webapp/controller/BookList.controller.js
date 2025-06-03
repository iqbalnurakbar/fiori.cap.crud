sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/Fragment",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
  ],
  (Controller, Fragment, MessageToast, MessageBox) => {
    "use strict";

    return Controller.extend("fiori.research.controller.BookList", {
      // Holds the dialog instance (Add or Edit) so we load it only once
      _oAuthorDialog: null,

      // Stores the selected author’s binding context when editing
      _oEditContext: null,

      // Lifecycle hook—useful for initialization if needed
      onInit() {},

      /**
       * onAddAuthor
       * Lazy-loads and opens the “Add Author” dialog fragment.
       */
      onAddAuthor: async function () {
        if (!this._oAuthorDialog) {
          this._oAuthorDialog = await Fragment.load({
            id: this.getView().getId(),
            name: "fiori.research.view.AddAuthorDialog",
            controller: this,
          });
        }
        this._oAuthorDialog.open();
      },

      /**
       * onAuthorDialogCancel
       * Closes and destroys whichever dialog is open (Add or Edit).
       */
      onAuthorDialogCancel: function () {
        this._closeAndDestroyDialog();
      },

      /**
       * onAddAuthorConfirm
       * Reads input values, sends an OData CREATE request to /Authors,
       * displays feedback, then closes the dialog and refreshes the list.
       */
      onAddAuthorConfirm: async function () {
        const oModel = this.getView().getModel();
        const sFragId = this.getView().getId();
        const sName = Fragment.byId(sFragId, "addNameInput").getValue().trim();
        const sBio = Fragment.byId(sFragId, "addBioInput").getValue().trim();

        try {
          const oListBinding = oModel.bindList("/Authors");
          await oListBinding.create({ name: sName, bio: sBio }).created();
          MessageToast.show("Author created");
        } catch (error) {
          MessageBox.error(error.message);
        }

        this._closeAndDestroyDialog();
        this._refreshAuthorList();
      },

      /**
       * onEditAuthor
       * Ensures exactly one author is selected, saves its context,
       * pre-fills the Edit dialog inputs, and opens the dialog.
       */
      onEditAuthor: async function () {
        const oList = this.byId("authorList");
        const aContexts = oList.getSelectedContexts();

        if (aContexts.length !== 1) {
          MessageToast.show("Please select one author to edit.");
          return;
        }

        // Keep the selected context for the update call
        this._oEditContext = aContexts[0];
        const oData = this._oEditContext.getObject();

        // Load the Edit fragment if not already loaded
        if (!this._oAuthorDialog) {
          this._oAuthorDialog = await Fragment.load({
            id: this.getView().getId(),
            name: "fiori.research.view.EditAuthorDialog",
            controller: this,
          });
        }

        // Prefill dialog fields with the selected author’s current data
        const sFragId = this.getView().getId();
        Fragment.byId(sFragId, "editNameInput").setValue(oData.name);
        Fragment.byId(sFragId, "editBioInput").setValue(oData.bio);

        this._oAuthorDialog.open();
      },

      /**
       * onEditAuthorConfirm
       * Reads updated values, updates the bound context properties,
       * submits the OData update batch, shows feedback,
       * then closes the dialog and refreshes the list.
       */
      onEditAuthorConfirm: async function () {
        const sFragId = this.getView().getId();
        const oModel = this.getView().getModel();
        const sName = Fragment.byId(sFragId, "editNameInput").getValue().trim();
        const sBio = Fragment.byId(sFragId, "editBioInput").getValue().trim();
        const oContext = this._oEditContext; // previously stored binding context

        try {
          // Update the properties in the context
          await oContext.setProperty("name", sName);
          await oContext.setProperty("bio", sBio);
          // Submit the pending changes as a batch request
          await oModel.submitBatch(oModel.getUpdateGroupId());
          MessageToast.show("Author updated");
        } catch (error) {
          MessageBox.error(error.message);
        }

        this._closeAndDestroyDialog();
        this._refreshAuthorList();
      },

      onDeleteAuthor: function () {
        // Get reference to the authors list control
        const oList = this.byId("authorList");
        // Retrieve all selected contexts (binding contexts) from the list
        const aContexts = oList.getSelectedContexts();
        // We only care about the first selected context
        const oContext = aContexts[0];

        // Ensure exactly one author is selected before proceeding
        if (aContexts.length !== 1) {
          MessageToast.show("Please select one author to delete.");
          return;
        }

        // Show a confirmation dialog before hard-deleting the record
        MessageBox.confirm("Are you sure you want to delete this author?", {
          actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
          onClose: async function (sAction) {
            // If the user cancels, do nothing
            if (sAction !== MessageBox.Action.OK) {
              return;
            }

            try {
              // Perform the OData V4 delete operation on the selected context
              await oContext.delete();
              MessageToast.show("Author deleted successfully.");

              // Refresh the list so the deleted entry is removed from the UI
              this._refreshAuthorList();
            } catch (error) {
              // Show an error dialog if the delete request fails
              MessageBox.error(error.message);
            }
          }.bind(this), // Bind the handler so we can access `this._refreshAuthorList()`
        });
      },

      /**
       * _closeAndDestroyDialog
       * Closes and destroys the dialog fragment to release memory.
       */
      _closeAndDestroyDialog: function () {
        this._oAuthorDialog.close();
        this._oAuthorDialog.destroy();
        this._oAuthorDialog = null;
      },

      /**
       * _refreshAuthorList
       * Refreshes the list binding so changes (add/edit) appear immediately.
       */
      _refreshAuthorList: function () {
        const oList = this.byId("authorList");
        const oBinding = oList && oList.getBinding("items");
        if (oBinding) {
          oBinding.refresh();
        }
      },
    });
  }
);
