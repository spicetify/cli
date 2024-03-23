# Contributing to Spicetify-cli

## Table of Contents

- [I Have a Question](#i-have-a-question)
- [How to Contribute](#how-to-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Enhancements](#suggesting-enhancements)
  - [Your First Code Contribution](#your-first-code-contribution)
  - [Improving The Documentation](#improving-the-documentation)
  - [Commit Message Format](#commit-message-format)

## I Have a Question

> If you want to ask a question, we assume that you have read the available [Documentation](https://spicetify.app/docs/getting-started/).

Before you ask a question, it is best to search for existing [issues](https://github.com/spicetify/spicetify-cli/issues) that might help you. In case you have found a suitable issue and still need clarification, you can write your question in this issue. It is also advisable to search the internet for answers first.

If you then still feel the need to ask a question and need clarification, we recommend the following:

- Open an [issue](https://github.com/spicetify/spicetify-cli/issues/new).
- Provide both Spicetify and Spotify version.
- Explain what the problem is.

We will then take care of the issue as soon as possible.

## How to Contribute

> ### Legal Notice
> When contributing to this project, you must agree that you have authored 100% of the content, that you have the necessary rights to the content and that the content you contribute may be provided under the project license.

### Reporting Bugs

#### Before Submitting a Bug Report

A good bug report shouldn't leave others needing to chase you up for more information. Therefore, we ask you to investigate carefully, collect information and describe the issue in detail in your report. Please complete the following steps in advance to help us fix any potential bug as fast as possible.

- Make sure that you are using the latest version.
- Determine if your bug is really a bug and not an error on your side e.g. using incompatible environment components/versions (Make sure that you have read the [documentation](https://spicetify.app/docs/getting-started/). If you are looking for support, you might want to check [this section](#i-have-a-question)).
- To see if other users have experienced (and potentially already solved) the same issue you are having, check if there is not already a bug report existing for your bug or error in the [bug tracker](https://github.com/spicetify/spicetify-cli/labels/%F0%9F%90%9B%20bug).

#### How Do I Submit a Good Bug Report?

We use GitHub issues to track bugs and errors. If you run into an issue with the project:

- Open an [issue](https://github.com/spicetify/spicetify-cli/issues/new). (Since we can't be sure at this point whether it is a bug or not, we ask you not to talk about a bug yet and not to label the issue.)
  - Use the provided [bug template](https://github.com/spicetify/spicetify-cli/issues/new?assignees=&labels=%F0%9F%90%9B+bug&projects=&template=bug_report.yml).
- Explain the behavior you would expect and the actual behavior.
- Please provide as much context as possible and describe the *reproduction steps* that someone else can follow to recreate the issue on their own. This usually includes your code. For good bug reports you should isolate the problem and create a reduced test case.
- Provide the information you collected in the previous section.

### Suggesting Enhancements

This section guides you through submitting an enhancement suggestion for spicetify, **including completely new features and minor improvements to existing functionality**. Following these guidelines will help maintainers and the community to understand your suggestion and find related suggestions.

#### Before Submitting an Enhancement

- Make sure that you are using the latest version.
- Read the [documentation](https://spicetify.app/docs/getting-started/) carefully and find out if the functionality is already covered, maybe by an individual configuration.
- Perform a [search](https://github.com/spicetify/spicetify-cli/issues) to see if the enhancement has already been suggested. If it has, add a comment to the existing issue instead of opening a new one.
- Find out whether your idea fits with the scope and aims of the project. It's up to you to make a strong case to convince the project's developers of the merits of this feature. Keep in mind that we want features that will be useful to the majority of our users and not just a small subset. If you're just targeting a minority of users, consider writing an add-on/plugin library.

#### How Do I Submit a Good Enhancement Suggestion?

Enhancement suggestions are tracked as [GitHub issues](https://github.com/spicetify/spicetify-cli/issues). Create an enhancement suggestion using the provided [feature request template](https://github.com/spicetify/spicetify-cli/issues/new?assignees=&labels=%E2%9C%A8+feature&projects=&template=feature_request.yml).

- Use a **clear and descriptive title** for the issue to identify the suggestion.
- Provide a **step-by-step description of the suggested enhancement** in as many details as possible.
- **Describe the current behavior** and **explain which behavior you expected to see instead** and why. At this point you can also tell which alternatives do not work for you.
- For GUIs, you may want to **include screenshots** which help you demonstrate the steps or point out the part which the suggestion is related to. Animated GIFS and videos may be helpful but are not expected. Some tools available are the [built-in screen recorder](https://support.apple.com/en-us/102618) on macOS, [LICEcap](https://www.cockos.com/licecap/) on macOS and Windows, and [ShareX](https://getsharex.com/) on Linux.
- **Explain why this enhancement would be useful** to most spicetify users. You may also want to point out the other projects that solved it better and which could serve as inspiration.

### Your First Code Contribution

#### Requirements

- [Go](https://go.dev/dl/)

#### Environment Setup and Development

Follow the steps outlined in the [documentation](https://spicetify.app/docs/development/compiling) or the steps below.
1. Clone the repository using `git clone https://github.com/spicetify/spicetify-cli`.
2. Enter the repository directory and build the project.
   * Windows
      ```
      cd spicetify-cli
      go build -o spicetify.exe
      ```
   * Linux and MacOS
      ```
      cd spicetify-cli
      go build -o spicetify
      ```
3. Execute the executable file generated by `go build` using `./spicetify` or `./spicetify.exe`.

### Improving The Documentation

To improve the [documentation](https://spicetify.app/docs/getting-started), navigate to the documentation [repository](https://github.com/spicetify/spicetify-docs).

### Commit Message Format

    <type>(<scope>): <subject>
    <BLANK LINE>
    <body>[optional]

*   **type:** feat | fix | docs | chore | revert
    *   **feat:** A new feature
    *   **fix:** A bug fix
    *   **docs:** Documentation only changes
    *   **chore:** Changes to build process, auxiliary tools, libraries, and other things
    *   **revert:** A reversion to a previous commit
*   **scope:** Anything specifying place of the commit change
*   **subject:** What changes you have done
    *   Use the imperative, present tense: "change" not "changed" nor "changes"
    *   Don't capitalize first letter
    *   No dot (.) at the end
*   **body**: More details of your changes, you can mention the most important changes here
    *   Use the imperative, present tense: "change" not "changed" nor "changes"

If you want to learn more, view the [Angular - Git Commit Guidelines](https://github.com/angular/angular.js/blob/master/DEVELOPERS.md#-git-commit-guidelines).
