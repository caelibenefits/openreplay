package charts

import (
	"openreplay/backend/pkg/analytics/model"
	"reflect"
	"strings"
	"testing"
)

func TestBuildEventConditions(t *testing.T) {
	tests := []struct {
		name           string
		filters        []model.Filter
		options        []BuildConditionsOptions
		wantEventConds []string
		wantOtherConds []string
	}{
		{
			name: "Event filter with equals operator",
			filters: []model.Filter{
				{
					Name:     "CLICK",
					Operator: "is",
					Value:    []string{},
					IsEvent:  true,
					Filters: []model.Filter{
						{
							Name:     "label",
							Operator: "is",
							Value:    []string{"button"},
						},
					},
				},
			},
			wantEventConds: []string{"(e.\"$event_name\" = 'CLICK' AND (JSONExtractString(toString(e.properties), 'label') = 'button'))"},
			wantOtherConds: nil,
		},
		{
			name: "Event filter with isAny operator",
			filters: []model.Filter{
				{
					Name:     "CLICK",
					Operator: "isAny",
					Value:    []string{},
					IsEvent:  true,
				},
			},
			wantEventConds: []string{"(e.\"$event_name\" = 'CLICK')"},
			wantOtherConds: nil,
		},
		{
			name: "Event filter with contains operator",
			filters: []model.Filter{
				{
					Name:     "CLICK",
					Operator: "isAny",
					Value:    []string{},
					IsEvent:  true,
					Filters: []model.Filter{
						{
							Name:     "label",
							Operator: "contains",
							Value:    []string{"button"},
						},
					},
				},
			},
			wantEventConds: []string{"(e.\"$event_name\" = 'CLICK' AND (JSONExtractString(toString(e.properties), 'label') ILIKE '%button%'))"},
			wantOtherConds: nil,
		},

		{
			name: "Events filters with contains operator and multiple values",
			filters: []model.Filter{
				{
					Name:     "CLICK",
					Operator: "isAny",
					Value:    []string{},
					IsEvent:  true,
					Filters: []model.Filter{
						{
							Name:     "url_path",
							Operator: "contains",
							Value:    []string{"login", "signup"},
						},
					},
				},
			},
			wantEventConds: []string{"(e.\"$event_name\" = 'CLICK' AND ((e.\"$current_path\" ILIKE '%login%' OR e.\"$current_path\" ILIKE '%signup%')))"},
			wantOtherConds: nil,
		},

		{
			name: "Events filters with notEqual operator",
			filters: []model.Filter{
				{
					Name:     "CLICK",
					Operator: "is",
					Value:    []string{"login", "signup"},
					IsEvent:  true,
					Filters: []model.Filter{
						{
							Name:     "url_path",
							Operator: "isNot",
							Value:    []string{"login"},
						},
					},
				},
			},
			wantEventConds: []string{"(e.\"$event_name\" = 'CLICK' AND (e.\"$current_path\" != 'login'))"},
			wantOtherConds: nil,
		},
		{
			// NOTE: PropertyOrder is currently not used by addFilter for joining
			// nested sub-conditions — they are always joined with AND.
			name: "Events filters with multiple properties (nested) and proper order OR",
			filters: []model.Filter{
				{
					Name:          "CLICK",
					Operator:      "is",
					Value:         []string{},
					IsEvent:       true,
					PropertyOrder: "or",
					Filters: []model.Filter{
						{
							Name:     "label",
							Operator: "is",
							Value:    []string{"button"},
						},
						{
							Name:     "url_path",
							Operator: "is",
							Value:    []string{"login"},
						},
					},
				},
			},
			wantEventConds: []string{"(e.\"$event_name\" = 'CLICK' AND (JSONExtractString(toString(e.properties), 'label') = 'button') AND (e.\"$current_path\" = 'login'))"},
			wantOtherConds: nil,
		},
		{
			name: "Events filters with multiple properties (nested) and proper order AND",
			filters: []model.Filter{
				{
					Name:          "CLICK",
					Operator:      "is",
					Value:         []string{},
					IsEvent:       true,
					PropertyOrder: "and",
					Filters: []model.Filter{
						{
							Name:     "label",
							Operator: "is",
							Value:    []string{"button"},
						},
						{
							Name:     "url_path",
							Operator: "is",
							Value:    []string{"login"},
						},
					},
				},
			},
			wantEventConds: []string{"(e.\"$event_name\" = 'CLICK' AND (JSONExtractString(toString(e.properties), 'label') = 'button') AND (e.\"$current_path\" = 'login'))"},
			wantOtherConds: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotEventConds, _, gotOtherConds := BuildEventConditions(tt.filters, BuildConditionsOptions{
				MainTableAlias: "e",
				DefinedColumns: mainColumns,
			})

			if !reflect.DeepEqual(gotEventConds, tt.wantEventConds) {
				t.Errorf("BuildEventConditions() Events: \ngot = %v, \nwant %v", gotEventConds, tt.wantEventConds)
			}

			// Normalise nil vs empty slice for comparison
			if len(gotOtherConds) == 0 && len(tt.wantOtherConds) == 0 {
				return // both empty — pass
			}
			if !reflect.DeepEqual(gotOtherConds, tt.wantOtherConds) {
				t.Errorf("BuildEventConditions() OtherConds: \notherConds = %v, \nwant %v", gotOtherConds, tt.wantOtherConds)
			}
		})
	}
}

func TestGetColumnAccessor_DoesNotMutateSharedMap(t *testing.T) {
	// Snapshot the original value
	original := mainColumns["userCountry"][0]

	opts := BuildConditionsOptions{
		MainTableAlias: "e",
		DefinedColumns: mainColumns,
	}

	// Call twice — the bug causes progressive mutation
	getColumnAccessor("userCountry", false, false, false, opts)
	getColumnAccessor("userCountry", false, false, false, opts)

	if mainColumns["userCountry"][0] != original {
		t.Errorf("getColumnAccessor mutated shared map: got %q, want %q",
			mainColumns["userCountry"][0], original)
	}
}

func TestCamelToSnake(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"userCountry", "user_country"},
		{"userBrowser", "user_browser"},
		{"userOs", "user_os"},
		{"userId", "user_id"},
		{"alreadysnake", "alreadysnake"},
		{"ABCDef", "abcdef"},
		{"", ""},
	}
	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got := CamelToSnake(tt.input)
			if got != tt.want {
				t.Errorf("CamelToSnake(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestBuildCond_IsUndefined(t *testing.T) {
	got := buildCond("s.user_country", nil, "isUndefined", false, "singleColumn")
	want := "(isNull(s.user_country) OR s.user_country = '')"
	if got != want {
		t.Errorf("buildCond isUndefined:\ngot  = %q\nwant = %q", got, want)
	}
}

func TestBuildCond_IsUndefined_ArrayColumn(t *testing.T) {
	got := buildCond("s.issue_types", nil, "isUndefined", false, "arrayColumn")
	want := "empty(s.issue_types)"
	if got != want {
		t.Errorf("buildCond isUndefined array:\ngot  = %q\nwant = %q", got, want)
	}
}

// Test for getColumnAccessor function
func TestGetColumnAccessor(t *testing.T) {
	tests := []struct {
		name          string
		logical       string
		isNumeric     bool
		inDProperties bool
		inProperties  bool
		opts          BuildConditionsOptions
		wantAccessor  string
		wantNature    string
	}{
		{
			name:          "Defined column mapping",
			logical:       "userDevice",
			isNumeric:     false,
			inDProperties: false,
			inProperties:  false,
			opts: BuildConditionsOptions{
				MainTableAlias: "e",
				DefinedColumns: mainColumns,
			},
			wantAccessor: "sessions.user_device",
			wantNature:   "singleColumn",
		},
		{
			name:          "Column with $ prefix gets quoted",
			logical:       "$special",
			isNumeric:     false,
			inDProperties: true,
			inProperties:  false,
			opts: BuildConditionsOptions{
				MainTableAlias:       "e",
				PropertiesColumnName: "$properties",
			},
			wantAccessor: "JSONExtractString(toString(e.\"$properties\"), '$special')",
			wantNature:   "singleColumn",
		},
		{
			name:          "Numeric property extraction",
			logical:       "count",
			isNumeric:     true,
			inDProperties: true,
			inProperties:  false,
			opts: BuildConditionsOptions{
				MainTableAlias:       "e",
				PropertiesColumnName: "$properties",
			},
			wantAccessor: "JSONExtractFloat(toString(e.\"$properties\"), 'count')",
			wantNature:   "singleColumn",
		},
		{
			name:          "Property mapping from propertyKeyMap",
			logical:       "LOCATION",
			isNumeric:     false,
			inDProperties: false,
			inProperties:  false,
			opts: BuildConditionsOptions{
				MainTableAlias:       "e",
				PropertiesColumnName: "$properties",
			},
			wantAccessor: "e.\"$current_path\"",
			wantNature:   "singleColumn",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotAccessor, gotNature := getColumnAccessor(tt.logical, tt.isNumeric, tt.inDProperties, tt.inProperties, tt.opts)
			if gotAccessor != tt.wantAccessor {
				t.Errorf("getColumnAccessor() accessor = %v, want %v", gotAccessor, tt.wantAccessor)
			}
			if gotNature != tt.wantNature {
				t.Errorf("getColumnAccessor() nature = %v, want %v", gotNature, tt.wantNature)
			}
		})
	}
}

// caeli: the session list's "Internal hidden" toggle excludes sessions by the
// "ip" metadata. Sessions recorded before the key existed have it NULL, and
// they are not internal traffic, so a negative filter must keep them.
func TestAddFilter_NegativeMetadataKeepsMissingValues(t *testing.T) {
	for _, op := range []string{"isNot", "notContains", "notStartsWith"} {
		f := model.Filter{Name: "metadata_7", Operator: op, Value: []string{"67.160.35.32"}, AutoCaptured: true}
		conds, _ := addFilter(f, BuildConditionsOptions{}, false)
		if len(conds) != 1 || !strings.HasPrefix(conds[0], "(isNull(metadata_7) OR ") {
			t.Fatalf("%s: got %q, want an isNull(metadata_7) OR … guard", op, conds)
		}
	}
	// The Internal toggle sends up to 10 IPs per filter: the guard must wrap the
	// whole NOT IN / NOT (… OR …), not one value of it.
	for _, op := range []string{"isNot", "notContains", "notStartsWith"} {
		f := model.Filter{Name: "metadata_7", Operator: op, Value: []string{"67.160.35.32", "66.249."}, AutoCaptured: true}
		conds, _ := addFilter(f, BuildConditionsOptions{}, false)
		if len(conds) != 1 || !strings.HasPrefix(conds[0], "(isNull(metadata_7) OR ") || !strings.HasSuffix(conds[0], ")") ||
			strings.Count(conds[0], "isNull") != 1 || !strings.Contains(conds[0], "67.160.35.32") || !strings.Contains(conds[0], "66.249.") {
			t.Fatalf("%s, two values: got %q, want one isNull(metadata_7) OR … guard around both", op, conds)
		}
	}
	// A positive filter must still require the value.
	pos, _ := addFilter(model.Filter{Name: "metadata_7", Operator: "is", Value: []string{"67.160.35.32"}, AutoCaptured: true}, BuildConditionsOptions{}, false)
	if len(pos) != 1 || strings.Contains(pos[0], "isNull") {
		t.Fatalf("is: got %q, want no isNull guard", pos)
	}
}

func TestBuildCond_NotStartsWith(t *testing.T) {
	got := buildCond("metadata_7", []string{"66.249."}, "notStartsWith", false, "singleColumn")
	if !strings.HasPrefix(got, "NOT (") || !strings.Contains(got, "66.249.%") || !strings.Contains(got, "ILIKE") {
		t.Fatalf("got %q, want NOT (metadata_7 ILIKE '66.249.%%')", got)
	}
	// Not a substring match: 166.249.x.x must not be excluded by a 66.249. prefix.
	if strings.Contains(got, "%66.249.") {
		t.Fatalf("got %q: a leading %% would make it a substring match", got)
	}
}

// caeli: "events > x" filters the sessions table's events_count, like
// duration; it used to compile to a lookup in the events' properties.
func TestBuildWhere_EventsCountIsASessionsColumn(t *testing.T) {
	for _, name := range []string{"eventsCount", "events_count"} {
		f := model.Filter{Name: name, Operator: ">", Value: []string{"1"}, DataType: "number", AutoCaptured: true}
		_, flt, _, sess := BuildWhere([]model.Filter{f}, "then", "e", "s")
		if len(flt) != 0 {
			t.Fatalf("%s: still compiled as an event property: %q", name, flt)
		}
		if len(sess) != 1 || sess[0] != "s.events_count > 1" {
			t.Fatalf("%s: got %q, want [s.events_count > 1]", name, sess)
		}
	}
	// Garbage never reaches SQL.
	bad := model.Filter{Name: "eventsCount", Operator: ">", Value: []string{"1; DROP"}, AutoCaptured: true}
	if _, _, _, sess := BuildWhere([]model.Filter{bad}, "then", "e", "s"); len(sess) != 0 {
		t.Fatalf("non-numeric value produced %q", sess)
	}
}

// caeli: "Projected >= $n" keeps the sessions worth n dollars or more, and visitors' orders
// (not the canaries', which order every day as "internal").
func TestBuildWhere_InterestIsASessionValueLookup(t *testing.T) {
	f := model.Filter{Name: "interestValue", Operator: ">=", Value: []string{"5"}, DataType: "number"}
	ev, flt, neg, sess := BuildWhere([]model.Filter{f}, "then", "e", "s")
	if len(ev)+len(flt)+len(neg) != 0 {
		t.Fatalf("still compiled as an event condition: %q %q %q", ev, flt, neg)
	}
	// The other builders run every filter through BuildEventConditions too.
	if ev, _, misc := BuildEventConditions([]model.Filter{f}, BuildConditionsOptions{MainTableAlias: "e"}); len(ev)+len(misc) != 0 {
		t.Fatalf("BuildEventConditions compiled it: %q %q", ev, misc)
	}
	want := "s.session_id IN (SELECT session_id FROM caeli.session_value FINAL WHERE dollars >= 5 OR (ordered = 1 AND dollars IS NOT NULL))"
	if len(sess) != 1 || sess[0] != want {
		t.Fatalf("got %q, want [%s]", sess, want)
	}
	f.Value = []string{"0.5"}
	if _, _, _, sess := BuildWhere([]model.Filter{f}, "then", "e", "s"); len(sess) != 1 || !strings.Contains(sess[0], "dollars >= 0.5 OR") {
		t.Fatalf("a fractional step: %q", sess)
	}
	// Garbage, out-of-range values and other operators never reach SQL.
	for _, bad := range []model.Filter{
		{Name: "interestValue", Operator: ">=", Value: []string{"5) OR 1=1 --"}},
		{Name: "interestValue", Operator: ">=", Value: []string{"1e9"}},
		{Name: "interestValue", Operator: ">=", Value: []string{"NaN"}},
		{Name: "interestValue", Operator: ">=", Value: []string{"-1"}},
		{Name: "interestValue", Operator: "<", Value: []string{"5"}},
	} {
		if ev, flt, _, sess := BuildWhere([]model.Filter{bad}, "then", "e", "s"); len(ev)+len(sess)+len(flt) != 0 {
			t.Fatalf("%v produced %q %q %q", bad, ev, sess, flt)
		}
	}
}

// caeli: "Bots hidden" also drops what the grader called not a visitor, but
// never our own traffic (the Internal toggle's) or a session not graded yet.
func TestBuildWhere_HideNotVisitorsIsASessionValueLookup(t *testing.T) {
	f := model.Filter{Name: "hideNotVisitors", Operator: "is", Value: []string{"true"}}
	ev, flt, neg, sess := BuildWhere([]model.Filter{f}, "then", "e", "s")
	if len(ev)+len(flt)+len(neg) != 0 {
		t.Fatalf("still compiled as an event condition: %q %q %q", ev, flt, neg)
	}
	if ev, _, misc := BuildEventConditions([]model.Filter{f}, BuildConditionsOptions{MainTableAlias: "e"}); len(ev)+len(misc) != 0 {
		t.Fatalf("BuildEventConditions compiled it: %q %q", ev, misc)
	}
	want := "s.session_id NOT IN (SELECT session_id FROM caeli.session_value FINAL WHERE value IS NULL AND tier != 'internal')"
	if len(sess) != 1 || sess[0] != want {
		t.Fatalf("got %q, want [%s]", sess, want)
	}
	// Only "is true" hides anything; any other shape is ignored, never inverted.
	for _, other := range []model.Filter{
		{Name: "hideNotVisitors", Operator: "is", Value: []string{"false"}},
		{Name: "hideNotVisitors", Operator: "isNot", Value: []string{"true"}},
		{Name: "hideNotVisitors", Operator: "is"},
	} {
		if _, _, _, sess := BuildWhere([]model.Filter{other}, "then", "e", "s"); len(sess) != 0 {
			t.Fatalf("%v produced %q", other, sess)
		}
	}
}

// caeli: the table widget builds its own session conditions; a negative
// metadata filter there must keep sessions without the value, like the list.
func TestTableSessionConditions_NegativeMetadataKeepsMissingValues(t *testing.T) {
	f := model.Filter{Name: "metadata_7", Operator: "isNot", Value: []string{"67.160.35.32"}, AutoCaptured: true}
	p := &Payload{MetricPayload: &model.MetricPayload{Series: []model.Series{{Filter: model.FilterGroup{Filters: []model.Filter{f}}}}}}
	conds := (&TableQueryBuilder{}).buildSessionConditions(p, "", nil)
	var meta []string
	for _, c := range conds {
		if strings.Contains(c, "metadata_7") {
			meta = append(meta, c)
		}
	}
	if len(meta) != 1 || !strings.Contains(meta[0], "isNull(metadata_7) OR ") {
		t.Fatalf("got %q, want one metadata_7 condition with an isNull(metadata_7) OR … guard", conds)
	}
}

// caeli: a negative event filter is reversed into the negative-events branch;
// notStartsWith must reverse to startsWith, not stay itself.
func TestReverseOperator_StartsWith(t *testing.T) {
	for op, want := range map[string]string{"notStartsWith": "startsWith", "startsWith": "notStartsWith"} {
		if got := reverseOperator(op); got != want {
			t.Fatalf("reverseOperator(%q) = %q, want %q", op, got, want)
		}
	}
}
