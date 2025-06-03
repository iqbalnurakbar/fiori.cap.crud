using {com.iqbal.cap as my} from '../db/entities/books';


service BookService @(path: 'books') {
  entity Authors as projection on my.Authors;
  entity Books   as projection on my.Books;

}
