import {Suite, assertThat} from "../../TestUtil.js";
import {Matrix} from "../../../src/engine/math/matrix/Matrix.js";
import {Complex} from "../../../src/engine/math/complex/Complex.js";
import {operatorModel, stateModel} from "../../../src/components/math/matrixModel.js";

const suite = new Suite("Matrix presentation model");

suite.test("operator rows are output and columns are input, with shared basis labels", () => {
    const matrix = Matrix.square(1, new Complex(0, 1), 0.5, -1);
    const model = operatorModel(matrix, i => ["A", "B"][i], {rowHeight: 40});
    assertThat(model.at(0, 1)).isEqualTo(new Complex(0, 1));
    assertThat(model.at(1, 0)).isEqualTo(new Complex(0.5, 0));
    assertThat(model.rowLabel(1)).isEqualTo("|B⟩");
    assertThat(model.colLabel(0)).isEqualTo("|A⟩");
    assertThat(model.layout.rowHeight).isEqualTo(40);
    assertThat(model.kind).isEqualTo("operator");
});

suite.test("state vectors retain basis order and amplitudes", () => {
    const model = stateModel(Matrix.col(0, 0.5, new Complex(0, -0.5), Math.SQRT1_2));
    assertThat(model.rows).isEqualTo(4);
    assertThat(model.cols).isEqualTo(1);
    assertThat(model.kind).isEqualTo("state");
    assertThat(model.rowLabel(2)).isEqualTo("|10⟩");
    assertThat(model.at(2)).isEqualTo(new Complex(0, -0.5));
});
