The create route trims the title but not the text, so leading and trailing whitespace is
preserved in one field and stripped in the other. That inconsistency will bite whoever
tries to compare or deduplicate notes later.
