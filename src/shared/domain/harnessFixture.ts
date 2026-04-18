import {
  HARNESS_CONTENT_FORMAT,
  HARNESS_CONTENT_SCHEMA_VERSION,
  HARNESS_DOCUMENT_ID,
  HARNESS_DOCUMENT_TITLE,
  type JsonObject,
  type SeedFixtureResult,
  type StoredDocumentSnapshot,
  collectDocumentMetrics,
} from "./document";

const chapterTitles = [
  "The Sound Beneath White Harbor",
  "Lanterns for the Glass Archive",
  "A Map of Ashmere in Winter Ink",
  "The Salt Tax of Larkspur Gate",
  "Pilgrims Under the Bone Moon",
  "A Census of Empty Watchtowers",
  "The Ferry Ledger and the Oracle",
  "Cinders in the Court of Tides",
  "The Quiet Machinery of Oathmakers",
  "A Roomful of Northbound Names",
  "The Surveyor at Gannet Reach",
  "A Weather Table for Traitor Winds",
  "The Bells Beneath Saint Brine",
  "When the Marsh Roads Rose",
  "The Night Captain's Measure",
  "The Orchard of Broken Seals",
  "The Tally of Unburned Letters",
  "What the River Kept for Spring",
  "The Last Harbor Before the Fens",
  "A Grammar of Ash and Iron",
  "The Hour Between Signal Fires",
  "The Pilgrim Market at Hallow Quay",
  "An Inventory of Quiet Knives",
  "The Snowline Above the Archive",
];

const names = [
  "Aurelia Vale",
  "Captain Elian Rook",
  "Mira Thorn",
  "Jonas Vey",
  "Sister Calve",
  "Tomas Wren",
  "The Oracle of Brackish House",
];

const places = [
  "White Harbor",
  "Ashmere",
  "Larkspur Gate",
  "the Glass Archive",
  "Gannet Reach",
  "Hallow Quay",
  "the Saint Brine causeway",
  "the Fenward Steps",
];

const objects = [
  "brass astrolabe",
  "ledger of ferry debts",
  "salt-black compass",
  "lantern case of blue mica",
  "reed-wrapped treaty tube",
  "winter survey chain",
  "storm index of the northern shoals",
  "glass prayer tablets",
];

const moods = [
  "with a patience that made everyone else feel loud",
  "as if the room were listening back",
  "like the argument had begun two years earlier",
  "with the calm of someone who had already paid once",
  "as though memory itself were a navigable coast",
  "with the care usually reserved for relics or wounds",
];

const stakes = [
  "because the harbor courts would treat a missing page as a confession",
  "because every chart from the marsh border contradicted the last",
  "because rumor had started walking faster than the ferries",
  "because the winter stores were counted in promises as much as grain",
  "because someone had begun moving names from public ledgers into private ones",
  "because a single bad copy could send three families to the wrong shore",
];

type ProseMirrorNodeJson = {
  type: string;
  attrs?: Record<string, number | string | boolean>;
  text?: string;
  content?: ProseMirrorNodeJson[];
};

function buildParagraph(chapterIndex: number, paragraphIndex: number): string {
  const leadName = names[(chapterIndex + paragraphIndex) % names.length];
  const foilName = names[(chapterIndex + paragraphIndex + 2) % names.length];
  const place = places[(chapterIndex * 3 + paragraphIndex) % places.length];
  const secondPlace = places[(chapterIndex + paragraphIndex + 5) % places.length];
  const object = objects[(chapterIndex * 5 + paragraphIndex) % objects.length];
  const secondObject = objects[(chapterIndex + paragraphIndex + 3) % objects.length];
  const mood = moods[(chapterIndex + paragraphIndex) % moods.length];
  const stake = stakes[(chapterIndex * 2 + paragraphIndex) % stakes.length];
  const tally = chapterIndex + paragraphIndex + 3;
  const watchCount = (chapterIndex % 4) + 2;

  return [
    `${leadName} crossed ${place} before dawn carrying the ${object}, counting every lamp that still burned along the quay and noting which shutters stayed closed after the bell.`,
    `The clerk assigned to the morning ledger was ${foilName}, who copied the harbor figures ${mood} and kept correcting the margins whenever anyone spoke too confidently about the road north.`,
    `By custom the first witness of the day named the tide, the wind, and the last vessel to arrive from ${secondPlace}, yet this morning the witnesses argued over whether the vessel had arrived at all or had only been seen in reflected light.`,
    `Aurelia Vale insisted the discrepancy mattered because old disputes in White Harbor rarely began with swords; they began with two neat columns that should have matched and did not.`,
    `Captain Elian Rook, hearing that line for the third time this month, laid the ${secondObject} on the table and asked who had altered the survey marks by the breakwater during the night.`,
    `No one answered directly, but Sister Calve reminded the room that the Archive had already lost ${tally} inventories this season and that every missing inventory had described a route no mapmaker now wished to sign.`,
    `The argument moved from numbers to names, from names to ferries, and from ferries to the chain of watchtowers above Ashmere, where ${watchCount} signal braziers had gone dark one after another without any storm strong enough to explain it.`,
    `When the room finally settled, ${leadName} wrote a cleaner version of the report for the courier packet and underlined the same three places again: ${place}, ${secondPlace}, and the Glass Archive.`,
    `That copy would travel farther than the speakers in the room, which was why every sentence had to sound deliberate enough to survive retelling and plain enough to be trusted by a tired reader six months later.`,
    `Even then, each witness left with the sense that the true record lived somewhere just outside the page, waiting for the next return to the manuscript to reveal how much had quietly shifted.`,
  ].join(" ");
}

function buildHeading(level: number, text: string): ProseMirrorNodeJson {
  return {
    type: "heading",
    attrs: { level },
    content: [{ type: "text", text }],
  };
}

function buildParagraphNode(text: string): ProseMirrorNodeJson {
  return {
    type: "paragraph",
    content: [{ type: "text", text }],
  };
}

function buildEmptyDocumentJson(): JsonObject {
  return {
    type: "doc",
    content: [{ type: "paragraph" }],
  };
}

export function createEmptyHarnessSnapshot(): StoredDocumentSnapshot {
  return {
    id: HARNESS_DOCUMENT_ID,
    title: HARNESS_DOCUMENT_TITLE,
    contentFormat: HARNESS_CONTENT_FORMAT,
    contentSchemaVersion: HARNESS_CONTENT_SCHEMA_VERSION,
    contentJson: buildEmptyDocumentJson(),
    plainText: "",
    updatedAt: new Date().toISOString(),
  };
}

export function createLongManuscriptFixture(): SeedFixtureResult {
  const nodes: ProseMirrorNodeJson[] = [];
  const plainBlocks: string[] = [];

  for (let chapterIndex = 0; chapterIndex < chapterTitles.length; chapterIndex += 1) {
    const heading = `Chapter ${chapterIndex + 1}: ${chapterTitles[chapterIndex]}`;
    nodes.push(buildHeading(1, heading));
    plainBlocks.push(heading);

    for (let paragraphIndex = 0; paragraphIndex < 18; paragraphIndex += 1) {
      const paragraph = buildParagraph(chapterIndex, paragraphIndex);
      nodes.push(buildParagraphNode(paragraph));
      plainBlocks.push(paragraph);
    }
  }

  const plainText = plainBlocks.join("\n\n");
  const snapshot: StoredDocumentSnapshot = {
    id: HARNESS_DOCUMENT_ID,
    title: HARNESS_DOCUMENT_TITLE,
    contentFormat: HARNESS_CONTENT_FORMAT,
    contentSchemaVersion: HARNESS_CONTENT_SCHEMA_VERSION,
    contentJson: {
      type: "doc",
      content: nodes,
    },
    plainText,
    updatedAt: new Date().toISOString(),
  };

  return {
    snapshot,
    wordCount: collectDocumentMetrics(plainText).wordCount,
  };
}

