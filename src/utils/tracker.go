package utils

import (
	"io/ioutil"

	"gopkg.in/cheggaaa/pb.v2"
)

type tracker struct {
	instance *pb.ProgressBar
	total    int
}

// Tracker is a counter
type Tracker interface {
	Update(name string, err error)
	Finish()
	Reset()
	Quiet()
}

// NewTracker creates new tracker instance
func NewTracker(total int) Tracker {
	return tracker{
		instance: pb.ProgressBarTemplate(`[{{counters . }}] {{string . "name"}}`).Start(total),
		total:    total,
	}
}

func (t tracker) Update(name string, err error) {
	t.instance.Increment()
	t.instance.Set("name", name)
	if err != nil {
		PrintError(err.Error())
	}
}

func (t tracker) Finish() {
	t.instance.Set("name", "\x1B[32mOK\033[0m")
	t.instance.Finish()
}

func (t tracker) Reset() {
	t.instance.Start()
}

func (t tracker) Quiet() {
	t.instance.SetWriter(ioutil.Discard)
}
