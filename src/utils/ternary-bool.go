package utils

// TernaryBool is three-way boolean: default, true, false
type TernaryBool int

// IsDefault .
func (b TernaryBool) IsDefault() bool {
	return b == 0
}

// ToString .
func (b TernaryBool) ToString() string {
	if b == 1 {
		return "true"
	} else if b == -1 {
		return "false"
	}

	return ""
}

// ToForceOperator .
func (b TernaryBool) ToForceOperator() string {
	if b == 1 {
		return "true||"
	} else if b == -1 {
		return "false&&"
	}

	return ""
}
