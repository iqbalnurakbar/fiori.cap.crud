package com.iqbal.cap.zcap_sqllite.handlers;

// Spring annotation to register this class as a component
import org.springframework.stereotype.Component;

import com.sap.cds.ql.Select;
import com.sap.cds.services.cds.CdsCreateEventContext;
import com.sap.cds.services.cds.CqnService;
import com.sap.cds.services.handler.EventHandler;
import com.sap.cds.services.handler.annotations.Before;
import com.sap.cds.services.handler.annotations.ServiceName;
import com.sap.cds.services.persistence.PersistenceService;

// Generated types for our BookService entities
import cds.gen.bookservice.Authors_;
import cds.gen.bookservice.BookService_;
import cds.gen.bookservice.Books;
import cds.gen.bookservice.Books_;

@Component
// Bind this handler to the BookService defined in our CDS model
@ServiceName(BookService_.CDS_NAME)
public class BookServiceHandler implements EventHandler {

    // Inject the CAP persistence service for database operations
    private final PersistenceService db;

    public BookServiceHandler(PersistenceService db) {
        this.db = db;
    }

    // Before creating a Books record, run this method
    @Before(event = CqnService.EVENT_CREATE, entity = Books_.CDS_NAME)
    public void beforeCreateBook(CdsCreateEventContext context, Books book) {
        // 1. Ensure the book title is provided
        if (book.getTitle() == null || book.getTitle().isEmpty()) {
            throw new RuntimeException("Book title is required!");
        }

        // 2. Ensure the author ID is provided
        String authorID = book.getAuthorId();
        if (authorID == null || authorID.isEmpty()) {
            throw new RuntimeException("Author ID is required!");
        }

        // 3. Verify that the referenced author actually exists in the database
        boolean authorExists = db.run(
                Select.from(Authors_.class)
                        .columns(Authors_.ID)
                        .where(a -> a.ID().eq(authorID)))
                .first().isPresent();

        if (!authorExists) {
            // We throw a runtime exception here—this will bubble up
            // as a server error if the author is missing
            throw new RuntimeException("Author with ID " + authorID + " does not exist!");
        }

        // 4. Log success for diagnostic purposes
        System.out.println("Author exists: " + authorExists);
    }
}