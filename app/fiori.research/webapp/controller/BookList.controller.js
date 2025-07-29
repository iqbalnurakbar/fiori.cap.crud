sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/Fragment",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
  ],
  (Controller, Fragment, MessageToast, MessageBox, Filter, FilterOperator) => {
    "use strict";

    return Controller.extend("fiori.research.controller.BookList", {
      // Holds the dialog instance (Add or Edit) so we load it only once
      _oAuthorDialog: null,

      _oBookDialog: null,

      // Stores the selected author’s binding context when editing
      _oEditContext: null,

      // Stores the the selected author’s ID
      _sSelectedAuthorId: null,

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

      onDialogCancel: function () {
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
        // Get the authors list control instance
        const oList = this.byId("authorList");
        // Get the binding contexts (selected items) from the list
        const aContexts = oList.getSelectedContexts();
        // Only process the first selected context
        const oContext = aContexts[0];

        // Verify exactly one author is selected
        if (aContexts.length !== 1) {
          MessageToast.show("Please select one author to delete.");
          return;
        }

        // Prompt the user to confirm deletion
        MessageBox.confirm("Are you sure you want to delete this author?", {
          actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
          onClose: async function (sAction) {
            // If the user canceled, exit without deleting
            if (sAction !== MessageBox.Action.OK) {
              return;
            }

            try {
              // Perform a soft delete by setting isDeleted = true
              this._performSoftDelete(oContext);
              MessageToast.show("Author deleted successfully.");
              // Refresh the list so the change is reflected in the UI
              this._refreshAuthorList();
            } catch (error) {
              // Display an error message if deletion fails
              MessageBox.error(error.message);
            }
          }.bind(this), // Ensure `this` refers to the controller inside onClose
        });
      },

      onAuthorSelect: function () {
        // Get the reference to the author list control by its ID
        const oList = this.byId("authorList");

        // Get the currently selected item (author) from the list
        const oAuthorSelected = oList.getSelectedItem();

        // If no author is selected, exit the function
        if (!oAuthorSelected) {
          return;
        }

        // Retrieve the ID of the selected author from its binding context
        const sAuthorId = oAuthorSelected.getBindingContext().getProperty("ID");
        this._sSelectedAuthorId = sAuthorId;

        // Call a private function to bind and display books related to the selected author
        this._bindBooks(sAuthorId);
      },

      // Opens the “Add Book” dialog, loading it lazily the first time
      onAddBook: async function () {
        if (!this._oBookDialog) {
          this._oBookDialog = await Fragment.load({
            id: this.getView().getId(),
            name: "fiori.research.view.AddBookDialog",
            controller: this,
          });
        }
        this._oBookDialog.open();
      },

      // Reads input values, sends an OData CREATE for /Books, then refreshes the table
      onAddBookConfirm: async function () {
        const oModel = this.getView().getModel();
        const sFragId = this.getView().getId();

        // Retrieve and normalize input values
        const sTitle = Fragment.byId(sFragId, "addTitleInput")
          .getValue()
          .trim();
        const sDescr = Fragment.byId(sFragId, "addDescrInput")
          .getValue()
          .trim();
        let iStock = parseInt(
          Fragment.byId(sFragId, "addStockInput").getValue().trim(),
          10
        );
        const fPrice = Fragment.byId(sFragId, "addPriceInput")
          .getValue()
          .trim();
        const sCurrency = Fragment.byId(sFragId, "addCurrencyInput")
          .getValue()
          .trim()
          .toUpperCase();
        const sAuthorId = this._sSelectedAuthorId; // selected author’s key

        // Build payload for the CREATE request
        const bodyData = {
          author_ID: sAuthorId,
          title: sTitle,
          descr: sDescr,
          stock: iStock,
          price: fPrice,
          currency: { code: sCurrency },
        };

        try {
          // Issue CREATE against /Books and await confirmation
          const oListBinding = oModel.bindList("/Books");
          await oListBinding.create(bodyData).created();
          MessageToast.show("Book created");
          this._closeAndDestroyDialog();
          this._refreshBooks();
        } catch (error) {
          // Display error if the request fails
          MessageBox.error(error.message);
        }
      },

      // Handler for the “Edit Book” action:
      // • Ensures exactly one book is selected
      // • Stores its binding context for later update
      // • Lazy-loads the EditBookDialog fragment
      // • Prefills all input fields with the current book data
      // • Opens the dialog
      onEditBook: async function () {
        const oList = this.byId("booksTable");
        const aContexts = oList.getSelectedContexts();

        // Require one and only one selection
        if (aContexts.length !== 1) {
          MessageToast.show("Please select one book to edit.");
          return;
        }

        // Save the selected context for onEditBookConfirm
        this._oEditContext = aContexts[0];
        const oData = this._oEditContext.getObject();

        // Load the EditBookDialog fragment if not already loaded
        if (!this._oBookDialog) {
          this._oBookDialog = await Fragment.load({
            id: this.getView().getId(),
            name: "fiori.research.view.EditBookDialog",
            controller: this,
          });
          // Ensure the dialog is destroyed when the view is destroyed
          this.getView().addDependent(this._oBookDialog);
        }

        const sFragId = this.getView().getId();
        // Prefill the dialog inputs with the book’s existing values
        Fragment.byId(sFragId, "editTitleInput").setValue(oData.title);
        Fragment.byId(sFragId, "editDescrInput").setValue(oData.descr);
        Fragment.byId(sFragId, "editStockInput").setValue(oData.stock);
        Fragment.byId(sFragId, "editPriceInput").setValue(oData.price);
        Fragment.byId(sFragId, "editCurrencyInput").setValue(
          oData.currency_code
        );

        this._oBookDialog.open();
      },

      // Handler for the EditBookDialog’s “Save” button:
      // • Reads updated field values
      // • Updates properties in the stored binding context
      // • Submits a batch update to the OData service
      // • Shows a success toast or an error dialog
      // • Closes the dialog and refreshes the books table
      onEditBookConfirm: async function () {
        const oModel = this.getView().getModel();
        const sFragId = this.getView().getId();

        // Read and normalize updated values from the dialog
        const sTitle = Fragment.byId(sFragId, "editTitleInput")
          .getValue()
          .trim();
        const sDescr = Fragment.byId(sFragId, "editDescrInput")
          .getValue()
          .trim();
        let iStock = parseInt(
          Fragment.byId(sFragId, "editStockInput").getValue().trim(),
          10
        );
        const fPrice = Fragment.byId(sFragId, "editPriceInput")
          .getValue()
          .trim();
        const sCurrency = Fragment.byId(sFragId, "editCurrencyInput")
          .getValue()
          .trim()
          .toUpperCase();

        try {
          const oContext = this._oEditContext;
          // Apply each updated property to the binding context
          await oContext.setProperty("title", sTitle);
          await oContext.setProperty("descr", sDescr);
          await oContext.setProperty("stock", iStock);
          await oContext.setProperty("price", fPrice);
          await oContext.setProperty("currency_code", sCurrency);

          // Submit all pending changes in one batch
          await oModel.submitBatch(oModel.getUpdateGroupId());

          MessageToast.show("Book updated");
          this._closeAndDestroyDialog();
          this._refreshBooks();
        } catch (error) {
          MessageBox.error(error.message);
        }
      },

      onDeleteBook: function () {
        const oList = this.byId("booksTable");
        const aContexts = oList.getSelectedContexts();
        console.log(aContexts)

        if (aContexts.length !== 1) {
          MessageToast.show("Please select one book to delete.");
          return;
        }

        // Confirm with the user
        MessageBox.confirm("Are you sure you want to delete this book?", {
          actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
          onClose: async function (sAction) {
            if (sAction !== MessageBox.Action.OK) {
              return;
            }

            try {
              const oContext = aContexts[0];
await oContext.delete();
              // Perform the delete on the context
              this._performSoftDelete(oContext);

              MessageToast.show("Book deleted successfully.");

              // Refresh the list & clear books table
              this._bindBooks(this._sSelectedAuthorId);
            } catch (oError) {
              MessageToast.show(
                "Error deleting book: " + (oError.message || oError)
              );
            }
          }.bind(this),
        });
      },

      // Refreshes the books table so new entries appear immediately
      _refreshBooks: function () {
        const oTable = this.byId("booksTable");
        const oBinding = oTable.getBinding("items");
        if (oBinding) {
          oBinding.refresh();
        }
      },

      /**
       * _closeAndDestroyDialog
       * Closes and destroys the dialog fragment to release memory.
       */
      _closeAndDestroyDialog: function () {
        if (this._oAuthorDialog) {
          this._oAuthorDialog.close();
          this._oAuthorDialog.destroy();
          this._oAuthorDialog = null;
        }

        if (this._oBookDialog) {
          this._oBookDialog.close();
          this._oBookDialog.destroy();
          this._oBookDialog = null;
        }
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

      /**
       * Marks the given entity as deleted without removing it from the backend.
       * This “soft delete” simply sets the isDeleted flag to true,
       * allowing us to filter out or archive records without losing history.
       */
      _performSoftDelete: async function (oContext) {
        await oContext.setProperty("isDeleted", true);
      },

      /**
       * Permanently removes the given entity from the backend.
       * This “hard delete” issues an OData DELETE request on the context,
       * eliminating the record entirely.
       */
      _performHardDelete: async function (oContext) {
        await oContext.delete();
      },

      _bindBooks: function (sAuthorID) {
        const oTable = this.byId("booksTable");

        if (!sAuthorID) {
          oTable.unbindItems();
          return;
        }

        oTable.bindItems({
          path: "/Books",
          filters: [
            new Filter("author_ID", FilterOperator.EQ, sAuthorID),
            new Filter("isDeleted", FilterOperator.EQ, false),
          ],
          template: new sap.m.ColumnListItem({
            cells: [
              new sap.m.Text({ text: "{title}" }),
              new sap.m.Text({ text: "{descr}" }),
              new sap.m.ObjectNumber({ number: "{stock}" }),
              new sap.m.ObjectNumber({
                number: "{price}",
                unit: "{currency_code}",
              }),
            ],
          }),
        });
      },

      _refreshBooks: function () {
        const oTable = this.byId("booksTable");
        const oBinding = oTable.getBinding("items");
        if (oBinding) {
          oBinding.refresh();
        }
      },
    });
  }
);
