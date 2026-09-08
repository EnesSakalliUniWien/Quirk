/**
 * Copyright 2017 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const THROW_IF_EMPTY = { if_same_instance_as_this_then_throw: true };

/**
 * A private sygil/sentinel value that shouldn't ever be present in a sequence, and so can be used as a placeholder for
 * "not set yet" (unlike undefined or null, which are allowed to appear in sequences).
 */
const EMPTY_SYGIL = { not_a_normal_value: true };

const isIterable = (obj) => typeof Object(obj)[Symbol.iterator] === "function";

const emptyFallback = (result, alternative, errorMessage) => {
  if (result !== EMPTY_SYGIL) {
    return result;
  }
  if (alternative === THROW_IF_EMPTY) {
    throw new Error(errorMessage);
  }
  return alternative;
};

/**
 * The sequence operations an array doesn't already have: the lazy walk of an unbounded sequence,
 * extremes by a scoring function, splitting a sequence into runs, and the exactly-one check.
 *
 * Anything an array can do itself - map, filter, every, some, sorting, deduplication, slicing,
 * reducing - belongs on the array, so nothing here duplicates it. Reach for `seq(...)` at the
 * point one of the operations below is needed, and `toArray()` back out afterwards.
 */
class Seq {
  /**
   * Wraps the given array, collection, or other iterable.
   * Use fromGenerator for wrapping generator functions.
   *
   * @param {!(T[])|!Seq.<T>|!Iterable.<T>|*} obj
   * @param {!boolean=} isIteratorFunction
   * @template T
   */
  constructor(obj, isIteratorFunction = false) {
    let iterable;
    let iterator;
    if (obj instanceof Seq) {
      // Avoid double-wrapping.
      iterable = obj._iterable;
      iterator = obj[Symbol.iterator];
    } else if (isIteratorFunction) {
      iterable = { [Symbol.iterator]: obj };
      iterator = obj;
    } else {
      if (!isIterable(obj)) {
        throw new Error(`Not iterable: ${obj}`);
      }
      iterable = obj;
      iterator = obj[Symbol.iterator].bind(obj);
    }

    /**
     * The generator, array, or other iterable object wrapped by this Seq instance.
     * @type {!(T[])|!Iterable.<T>|*}
     * @template T
     */
    this._iterable = iterable;

    /**
     * Iterates over the sequence's items.
     * @returns {!Iterator.<T>}
     * @template T
     */
    this[Symbol.iterator] = iterator;
  }

  /**
   * Creates a re-usable iterable from a generator function like <code>function*() { yield 1; }</code>.
   *
   * Note that the obvious alternative, <code>new Seq(function*(){yield 1;}()}</code>, stops working after the
   * iterable has been iterated once.
   *
   * @param {!function() : Iterator.<T>} generatorFunction
   * @returns {!Seq.<T>}
   * @template T
   */
  static fromGenerator(generatorFunction) {
    return new Seq(generatorFunction, true);
  }

  /**
   * Returns the sequence of natural numbers, starting at 0 and incrementing without bound. Only
   * useful with takeWhile, which is what gives it an end.
   * @returns {!Seq.<!int>}
   */
  static naturals() {
    return Seq.fromGenerator(function* () {
      let i = 0;
      while (true) {
        yield i;
        i++;
      }
    });
  }

  /**
   * Returns an array containing the items of this sequence.
   * @returns {!(T[])}
   * @template T
   */
  toArray() {
    return Array.from(this._iterable);
  }

  /**
   * Returns a sequence with the same items, until one of the items fails to match the given predicate. Then the
   * sequence is cut short just before yielding that item.
   * @param {!function(T) : !boolean} predicate
   * @returns {!Seq.<T>}
   * @template T
   */
  takeWhile(predicate) {
    let seq = this._iterable;
    return Seq.fromGenerator(function* () {
      for (let e of seq) {
        if (!predicate(e)) {
          break;
        }
        yield e;
      }
    });
  }

  /**
   * Returns the highest-scoring item in the sequence, as determined by a scoring function.
   *
   * @param {!function(T) : !number} projection Determines the score of an item.
   * @param {=A} emptyErrorAlternative The value to return if the sequence is empty. If not provided, an error
   * is thrown when the sequence is empty.
   * @param {(function(A, A): !boolean)=} isALessThanBComparator The operation used to compare scores.
   * @returns {T|A}
   * @template T, A
   */
  maxBy(
    projection,
    emptyErrorAlternative = THROW_IF_EMPTY,
    isALessThanBComparator = (e1, e2) => e1 < e2,
  ) {
    let curMaxItem = EMPTY_SYGIL;
    let curMaxScore = EMPTY_SYGIL;
    for (let item of this._iterable) {
      // Delay computing the score for the first item, so that singleton lists never touch the score function.
      if (curMaxItem === EMPTY_SYGIL) {
        curMaxItem = item;
        continue;
      }
      if (curMaxScore === EMPTY_SYGIL) {
        curMaxScore = projection(curMaxItem);
      }

      let score = projection(item);
      if (isALessThanBComparator(curMaxScore, score)) {
        curMaxItem = item;
        curMaxScore = score;
      }
    }

    return emptyFallback(
      curMaxItem,
      emptyErrorAlternative,
      "Can't maxBy an empty sequence.",
    );
  }

  /**
   * Returns the lowest-scoring item in the sequence, as determined by a scoring function.
   *
   * @param {!function(T) : !number} projection Determines the score of an item.
   * @param {=A} emptyErrorAlternative The value to return if the sequence is empty. If not provided, an error
   * is thrown when the sequence is empty.
   * @param {(function(A, A): !boolean)=} isALessThanBComparator The operation used to compare scores.
   * @returns {T|A}
   * @template T, A
   */
  minBy(
    projection,
    emptyErrorAlternative = THROW_IF_EMPTY,
    isALessThanBComparator = (e1, e2) => e1 < e2,
  ) {
    return this.maxBy(projection, emptyErrorAlternative, (e1, e2) =>
      isALessThanBComparator(e2, e1),
    );
  }

  /**
   * Splits the sequence into runs of adjacent items that share a key, yielding each run as an array.
   * @param {!function(T):*} keySelector
   * @returns {!Seq.<!(T[])>}
   * @template T
   */
  segmentBy(keySelector) {
    let seq = this;
    return Seq.fromGenerator(function* () {
      let group = [];
      let lastKey = undefined;
      for (let item of seq) {
        let itemKey = keySelector(item);
        if (group.length > 0 && itemKey !== lastKey) {
          yield group;
          group = [];
        }
        group.push(item);
        lastKey = itemKey;
      }
      if (group.length > 0) {
        yield group;
      }
    });
  }

  /**
   * Returns the single item in the sequence. If there are no items or multiple items in the sequence, either an error
   * is thrown or an alternative value is returned.
   *
   * @param {=A} emptyManyErrorAlternative The value to return if the sequence is empty. If not provided, an error
   * is thrown when the sequence is empty or has more than one value.
   * @returns {T|A}
   * @template T, A
   */
  single(emptyManyErrorAlternative = THROW_IF_EMPTY) {
    let iter = this[Symbol.iterator]();

    let first = iter.next();
    if (!first.done && iter.next().done) {
      return first.value;
    }

    if (emptyManyErrorAlternative === THROW_IF_EMPTY) {
      if (first.done) {
        throw new Error("Empty sequence doesn't contain a single item.");
      } else {
        throw new Error("Sequence contains more than a single item.");
      }
    }

    return emptyManyErrorAlternative;
  }
}

/**
 * Wraps an iterable into a Seq.
 * @param {!(T[])|!Seq.<T>|!Iterable.<T>|*} iterable
 * @returns {!Seq.<T>}
 * @template T
 */
let seq = (iterable) => new Seq(iterable);

export { seq, Seq };
