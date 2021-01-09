'use strict';

//UTILS
Array.prototype.sum = function() {return this.reduce((a, b) => a+b, 0);}
Array.prototype.last = function(x) {x = x || 0; return this[this.length-1-x];}
Array.prototype.copy = function() {return this.slice(0, this.length);}
Array.prototype.remove = function(e) {
	let index = this.indexOf(e);
	if (index !== -1) {
		this.splice(index, 1);
		return true;
	}
	return false;
}
const getOrElse = (value, orElse) => value === undefined ? orElse : value;
const rnd = Math.random;