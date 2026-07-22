import type { FormFieldType } from "../types";

/**
 * UI metadata for each field type — keeps the editor's type-picker, badges
 * and per-type config sections in sync. Storage semantics live in the
 * spec; this is purely presentation.
 */
export interface FieldTypeMeta {
  type: FormFieldType;
  label: string;
  description: string;
  /** Whether this field type can carry a `mapsTo` mirror onto the parent record. */
  mappable: boolean;
}

export const FIELD_TYPE_GROUPS: Array<{
  group: string;
  items: FieldTypeMeta[];
}> = [
  {
    group: "Text",
    items: [
      {
        type: "text",
        label: "Short text",
        description: "Single-line text such as a name or ID number.",
        mappable: true,
      },
      {
        type: "long_text",
        label: "Long text",
        description: "Multi-line text for notes, comments or reasons.",
        mappable: false,
      },
      {
        type: "email",
        label: "Email",
        description: "Validated email address.",
        mappable: true,
      },
      {
        type: "phone",
        label: "Phone",
        description: "E.164 phone number.",
        mappable: true,
      },
      {
        type: "url",
        label: "URL",
        description: "A web address.",
        mappable: false,
      },
    ],
  },
  {
    group: "Numbers & toggles",
    items: [
      {
        type: "number",
        label: "Number",
        description: "Any numeric value, decimals allowed.",
        mappable: true,
      },
      {
        type: "integer",
        label: "Integer",
        description: "Whole numbers only.",
        mappable: true,
      },
      {
        type: "boolean",
        label: "Yes / No",
        description: "Simple toggle, not for consent.",
        mappable: false,
      },
      {
        type: "rating",
        label: "Rating",
        description: "Star or numeric rating from 1 up to a configured max.",
        mappable: false,
      },
    ],
  },
  {
    group: "Date & time",
    items: [
      {
        type: "date",
        label: "Date",
        description: "Calendar date, no time of day.",
        mappable: false,
      },
      {
        type: "time",
        label: "Time",
        description: "Time of day, no calendar date.",
        mappable: false,
      },
      {
        type: "datetime",
        label: "Date & time",
        description: "Combined calendar date and time.",
        mappable: false,
      },
    ],
  },
  {
    group: "Choice",
    items: [
      {
        type: "select",
        label: "Single choice",
        description: "Pick one option from a configured list.",
        mappable: true,
      },
      {
        type: "multi_select",
        label: "Multiple choice",
        description: "Pick several options from a configured list.",
        mappable: false,
      },
      {
        type: "country",
        label: "Country",
        description: "ISO country picker, list resolved at render time.",
        mappable: false,
      },
    ],
  },
  {
    group: "People & places",
    items: [
      {
        type: "address",
        label: "Address",
        description: "Structured address with country.",
        mappable: false,
      },
      {
        type: "host_picker",
        label: "Host",
        description: "Pick a host from this organization's staff directory.",
        mappable: true,
      },
      {
        type: "visitor_picker",
        label: "Returning visitor",
        description: "Pick a known visitor profile.",
        mappable: false,
      },
    ],
  },
  {
    group: "Files & identity",
    items: [
      {
        type: "file",
        label: "File upload",
        description: "PDF or document upload.",
        mappable: false,
      },
      {
        type: "image",
        label: "Image / photo",
        description: "Camera or image upload.",
        mappable: false,
      },
      {
        type: "signature",
        label: "Signature",
        description: "Captured signature image.",
        mappable: false,
      },
      {
        type: "id_document",
        label: "ID document",
        description: "Government ID with type, number and image.",
        mappable: false,
      },
    ],
  },
  {
    group: "Compliance & derived",
    items: [
      {
        type: "consent_checkbox",
        label: "Consent checkbox",
        description: "Mandatory NDPA-style consent with stored consent text.",
        mappable: false,
      },
      {
        type: "calculated",
        label: "Calculated",
        description: "Derived value computed from other fields on read.",
        mappable: true,
      },
    ],
  },
];

const META_BY_TYPE: Record<FormFieldType, FieldTypeMeta> =
  FIELD_TYPE_GROUPS.flatMap((g) => g.items).reduce(
    (acc, item) => {
      acc[item.type] = item;
      return acc;
    },
    {} as Record<FormFieldType, FieldTypeMeta>,
  );

export function fieldTypeMeta(type: FormFieldType): FieldTypeMeta {
  return META_BY_TYPE[type];
}

const STRING_TYPES: FormFieldType[] = [
  "text",
  "long_text",
  "email",
  "phone",
  "url",
];
const NUMERIC_TYPES: FormFieldType[] = ["number", "integer", "rating"];
const TEMPORAL_TYPES: FormFieldType[] = ["date", "time", "datetime"];
const OPTION_TYPES: FormFieldType[] = ["select", "multi_select"];
const FILE_TYPES: FormFieldType[] = ["file", "image", "signature"];

export function isStringType(t: FormFieldType): boolean {
  return STRING_TYPES.includes(t);
}
export function isNumericType(t: FormFieldType): boolean {
  return NUMERIC_TYPES.includes(t);
}
export function isTemporalType(t: FormFieldType): boolean {
  return TEMPORAL_TYPES.includes(t);
}
export function isOptionType(t: FormFieldType): boolean {
  return OPTION_TYPES.includes(t);
}
export function isFileType(t: FormFieldType): boolean {
  return FILE_TYPES.includes(t);
}

export const MAPS_TO_OPTIONS = [
  { value: "", label: "Don't mirror to record" },
  { value: "visitor.full_name", label: "Visitor → full name" },
  { value: "visitor.phone", label: "Visitor → phone" },
  { value: "visitor.email", label: "Visitor → email" },
  { value: "visitor.company", label: "Visitor → company" },
  { value: "purpose", label: "Record → purpose" },
  { value: "expected_duration_minutes", label: "Record → expected duration" },
  { value: "host_id", label: "Record → host" },
  { value: "department_id", label: "Record → department" },
] as const;

export const TARGET_TYPE_LABEL: Record<
  "appointment" | "checkin" | "visit_session",
  { title: string; description: string }
> = {
  appointment: {
    title: "Appointments",
    description:
      "Form fields collected when someone books a future visit. A form is required for appointments.",
  },
  checkin: {
    title: "Check-ins",
    description:
      "Form fields the receptionist captures when registering an arriving visitor.",
  },
  visit_session: {
    title: "Visit sessions",
    description:
      "Form fields tracked across the staged self-registration flow from arrival to badge.",
  },
};
