/** Models for Lunchly */

const pg = require("pg");
const moment = require("moment");

const db = new pg.Client("postgresql://localhost/lunchly");
db.connect();

const BEST_CUSTOMER_LIMIT = 10;
/** A reservation for a party */

class Reservation {
  constructor({id, customerId, numGuests, startAt, notes}) {
    this.id = id;
    this.customerId = customerId;
    this.numGuests = numGuests;
    this.startAt = startAt;
    this.notes = notes;
  }

  /** methods for setting/getting startAt time */

  set startAt(val) {
    if (val instanceof Date && !isNaN(val)) this._startAt = val;
    else throw new Error("Not a valid startAt.");
  }

  get startAt() {
    return this._startAt;
  }

  get formattedStartAt() {
    return moment(this.startAt).format('MMMM Do YYYY, h:mm a');
  }

  /** methods for setting/getting notes (keep as a blank string, not NULL) */

  set notes(val) {
    this._notes = val || '';
  }

  get notes() {
    return this._notes;
  }

  /** methods for setting/getting customer ID: can only set once. */

  set customerId(val) {
    if (this._customerId && this._customerId !== val)
      throw new Error('Cannot change customer ID');
    this._customerId = val;
  }

  get customerId() {
    return this._customerId;
  }

  /** methods for setting/getting number of guests */

  set numGuests(val) {
    if (val < 1) throw new Error('Reservations must have at least 1 guest.');
    this._numGuests = val;
  }

  get numGuests() {
    return this._numGuests;
  }

  /** given a customer id, find their reservations. */

  static async getReservationsForCustomer(customerId) {
    const results = await db.query(
          `SELECT id, 
           customer_id AS "customerId", 
           num_guests AS "numGuests", 
           start_at AS "startAt", 
           notes AS "notes"
         FROM reservations 
         WHERE customer_id = $1`,
        [customerId]
    );

    return results.rows.map(row => new Reservation(row));
  }

  /** find a reservation by id. */

  static async get(id) {
    const result = await db.query(
          `SELECT id, 
           customer_id AS "customerId", 
           num_guests AS "numGuests", 
           start_at AS "startAt",
           notes
         FROM reservations 
         WHERE id = $1`,
        [id]
    );

    return new Reservation(result.row[0]);
  }

  /** save this reservation */

  async save() {
    if (this.id === undefined) {
      // insert
      const result = await db.query(
        `INSERT INTO reservations (customer_id, num_guests, start_at, notes)
        VALUES ($1, $2, $3, $4) RETURNING id`, 
        [this.customerId, this.numGuests, this.startAt, this.notes]
      );
      this.id = result.rows[0].id;
      console.log('Inserted', this.id);
    } else {
      // update
      const result = await db.query(
        `UPDATE reservations SET 
        customer_id=$1, num_guests=$2, start_at=$3, notes=$4
        WHERE id=$5`, 
        [this.customerId, this.numGuests, this.startAt, this.notes, this.id]
      );
      this.id = result.rows[0].id;
      console.log('Updated', this.id);
    }
  }

}

/** Customer of the restaurant. */

class Customer {
  constructor({id, firstName, lastName, phone, notes}) {
    this.id = id;
    this.firstName = firstName;
    this.lastName = lastName;
    this.phone = phone;
    this.notes = notes;
  }

  /** methods for getting/setting notes (keep as empty string, not NULL) */

  set notes(val) {
    this._notes = val || '';
  }

  get notes() {
    return this._notes;
  }

  /** methods for getting/setting phone #. */

  set phone(val) {
    this._phone = val || null;
  }

  get phone() {
    return this._phone;
  }

  /** methods for getting full name */

  get fullname() {
    return `${this.firstName} ${this.lastName}`;
  }

  /** find all customers. */

  static async all() {
    const results = await db.query(
          `SELECT id, 
         first_name AS "firstName",  
         last_name AS "lastName", 
         phone, 
         notes
       FROM customers
       ORDER BY last_name, first_name`
    );
    return results.rows.map(c => new Customer(c));
  }

  /** get customers filtered by name */
  static async some(name) {
    const capitalized = name[0].toUpperCase().concat(name.slice(1));
    console.log(capitalized)
    const results = await db.query(
      `SELECT id, 
         first_name AS "firstName",  
         last_name AS "lastName", 
         phone, 
         notes
       FROM customers
       WHERE first_name LIKE $1 OR last_name LIKE $1 OR
       first_name LIKE $2 OR last_name LIKE $2 OR
       first_name LIKE $3 OR last_name LIKE $3
       ORDER BY last_name, first_name`,
       [`%${name}%`, `%${name.toLowerCase()}%`, `%${capitalized}%`]
    );
    console.log(results);
    return results.rows.map(c => new Customer(c))
  }

  /** get a customer by ID. */

  static async get(id) {
    const results = await db.query(
          `SELECT id, 
         first_name AS "firstName",  
         last_name AS "lastName", 
         phone, 
         notes 
        FROM customers WHERE id = $1`,
        [id]
    );
    return new Customer(results.rows[0]);
  }

  /** get all reservations for this customer. */

  async getReservations() {
    return await Reservation.getReservationsForCustomer(this.id);
  }

  /**Get top ten customer */
  static async getBestCustomers() {
    const results = await db.query(
      `SELECT customer_id AS "id", first_name AS "firstName", 
      last_name AS "lastName", phone, customers.notes 
      FROM reservations 
      JOIN customers ON customer_id=customers.id
      GROUP BY customer_id, first_name, last_name, phone, customers.notes
      ORDER BY COUNT(*) desc LIMIT $1`,
      [BEST_CUSTOMER_LIMIT]
    );
    let customers = results.rows.map(row => new Customer(row));
    return customers;
  }

  /** save this customer. */

  async save() {
    if (this.id === undefined) {
      const result = await db.query(
            `INSERT INTO customers (first_name, last_name, phone, notes)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
          [this.firstName, this.lastName, this.phone, this.notes]);
      console.log("result", result.rows[0].id);
      this.id = result.rows[0].id;
    } else {
      await db.query(
            `UPDATE customers SET first_name=$1, last_name=$2, phone=$3, notes=$4
             WHERE id=$5`,
          [this.firstName, this.lastName, this.phone, this.notes, this.id]);
    }
  }
}


module.exports = {Customer, Reservation};
