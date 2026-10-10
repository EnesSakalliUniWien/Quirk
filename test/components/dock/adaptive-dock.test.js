import { createDockview } from "dockview-react";
import { Suite, assertThat } from "../../TestUtil.js";
import { AdaptiveDock } from "../../../src/components/adaptive-dock.js";

const suite = new Suite("AdaptiveDock");

function fixture() {
  const host = document.createElement("div");
  Object.assign(host.style, { width: "1200px", height: "600px" });
  document.body.append(host);
  const elements = new Map();
  const disposed = [];
  const api = createDockview(host, {
    createComponent: ({ id }) => {
      const element = document.createElement("input");
      element.value = `draft:${id}`;
      elements.set(id, element);
      return {
        element,
        init() {},
        dispose() {
          disposed.push(id);
        },
      };
    },
  });
  api.layout(1200, 600);
  const add = (id, position) =>
    api.addPanel({ id, component: id, renderer: "always", position });
  add("circuit");
  add("gates", { referencePanel: "circuit", direction: "left" });
  add("state", { referencePanel: "circuit", direction: "right" });
  add("export", { referencePanel: "state" });
  api.getPanel("gates").group.api.setSize({ width: 240 });
  api.getPanel("state").group.api.setSize({ width: 360 });
  api.getPanel("circuit").api.setActive();
  return {
    api,
    add,
    elements,
    disposed,
    close() {
      api.dispose();
      host.remove();
    },
  };
}

function shape(node) {
  return node.type === "leaf" ? node.data.views : node.data.map(shape);
}

suite.test(
  "narrow tabs restore nested wide groups without disposing panel drafts",
  () => {
    const f = fixture();
    try {
      f.add("algebra", { referencePanel: "state", direction: "below" });
      const before = f.api.toJSON();
      const drafts = new Map(f.elements);
      const adaptive = new AdaptiveDock(f.api);
      adaptive.setNarrow(true);
      assertThat(f.api.groups.length).isEqualTo(1);
      assertThat(f.api.panels.length).isEqualTo(5);
      assertThat(shape(adaptive.layout().grid.root)).isEqualTo(
        shape(before.grid.root),
      );
      adaptive.setNarrow(false);
      assertThat(shape(f.api.toJSON().grid.root)).isEqualTo(
        shape(before.grid.root),
      );
      assertThat(f.disposed).isEqualTo([]);
      for (const [id, input] of drafts) {
        assertThat(f.elements.get(id) === input).isEqualTo(true);
        assertThat(input.value).isEqualTo(`draft:${id}`);
      }
    } finally {
      f.close();
    }
  },
);

suite.test(
  "opening and closing narrow tabs updates the saved wide layout",
  () => {
    const f = fixture();
    try {
      const adaptive = new AdaptiveDock(f.api);
      adaptive.setNarrow(true);
      f.api.getPanel("export").api.close();
      f.add("qubits", { referencePanel: "circuit" });
      adaptive.reconcile();
      assertThat(f.api.groups.length).isEqualTo(1);
      const saved = adaptive.layout();
      assertThat(Object.keys(saved.panels).sort()).isEqualTo([
        "circuit",
        "gates",
        "qubits",
        "state",
      ]);
      adaptive.setNarrow(false);
      assertThat(
        f.api.getPanel("qubits").group === f.api.getPanel("state").group,
      ).isEqualTo(true);
      assertThat(
        f.api.getPanel("gates").group !== f.api.getPanel("circuit").group,
      ).isEqualTo(true);
      assertThat(f.api.getPanel("export")).isEqualTo(undefined);
    } finally {
      f.close();
    }
  },
);

suite.test(
  "a wide layout loaded on a narrow screen stays saved as wide",
  () => {
    const f = fixture();
    try {
      const saved = f.api.toJSON();
      f.api.layout(390, 600);
      const adaptive = new AdaptiveDock(f.api, saved);
      adaptive.setNarrow(true);
      assertThat(f.api.groups.length).isEqualTo(1);
      assertThat(adaptive.layout().grid.width).isEqualTo(1200);
      assertThat(shape(adaptive.layout().grid.root)).isEqualTo(
        shape(saved.grid.root),
      );
      f.api.layout(1200, 600);
      adaptive.setNarrow(false);
      assertThat(
        Math.abs(f.api.getPanel("gates").group.api.width - 240) < 3,
      ).isEqualTo(true);
      assertThat(shape(f.api.toJSON().grid.root)).isEqualTo(
        shape(saved.grid.root),
      );
    } finally {
      f.close();
    }
  },
);

suite.test(
  "a new inspector after closing the last one gets a wide column on restore",
  () => {
    const f = fixture();
    try {
      const adaptive = new AdaptiveDock(f.api);
      adaptive.setNarrow(true);
      f.api.getPanel("export").api.close();
      f.api.getPanel("state").api.close();
      adaptive.reconcile();
      f.add("qubits", { referencePanel: "circuit" });
      adaptive.reconcile();
      adaptive.setNarrow(false);
      assertThat(f.api.groups.length).isEqualTo(3);
      assertThat(
        f.api.getPanel("qubits").group !== f.api.getPanel("circuit").group,
      ).isEqualTo(true);
      assertThat(f.disposed.sort()).isEqualTo(["export", "state"]);
    } finally {
      f.close();
    }
  },
);
