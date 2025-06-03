using {
  cuid, // generates a UUID as primary key
  managed, // adds createdAt, createdBy, modifiedAt, modifiedBy fields
  Currency // built-in type for ISO currency codes and localized formatting
} from '@sap/cds/common';

namespace com.iqbal.cap; // defines the project’s namespace

/// Definition of the Authors entity
entity Authors : cuid, managed {
  name      : String; // author’s name
  bio       : String; // short biography
  isDeleted : Boolean default false; // soft-delete flag
  books     : Association to many Books
                on books.author = $self; // one-to-many link to Books
}

/// Definition of the Books entity
entity Books : cuid, managed {
  author    : Association to Authors; // many-to-one link to Authors
  title     : localized String; // book title, supports translations
  descr     : localized String; // book description, supports translations
  stock     : Integer; // number of items in inventory
  price     : Decimal(13, 2); // price with precision and scale
  currency  : Currency; // currency code (e.g., USD, EUR)
  isDeleted : Boolean default false; // soft-delete flag
}

/// Mandatory field annotations for Authors
annotate Authors with {
  name @mandatory; // name cannot be null
  bio  @mandatory; // bio cannot be null
};

/// Mandatory field annotations for Books
annotate Books with {
  author @mandatory; // author association must be set
  descr  @mandatory; // description cannot be null
  stock  @mandatory; // stock quantity cannot be null
};
