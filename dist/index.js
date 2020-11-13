const core = require('@actions/core');
const github = require('@actions/github');

const inputs = {
    token: core.getInput('repo-token', {required: true}),
    approval_count: core.getInput('approval-count', {required: true})
}

const octokit = new github.getOctokit(inputs.token);

const owner = github.context.repo.owner;
const repo = github.context.repo.repo;
const pull_request = github.context.payload.pull_request;
const action = github.context.payload.action;

const payload = github.context.payload;



if (action === 'opened') {
    //Once a review is opened (draft), the initial cr label should be applied
    octokit.issues.addLabels({
        owner,
        repo,
        issue_number: pull_request.number,
        labels:['cr: none']
    });
} else if (action === 'review_requested') {
    //Once reviewers have been requested, the cr is ready for review.
    //Initial cr label should be removed
    octokit.issues.addLabels({
        owner,
        repo,
        issue_number: pull_request.number,
        labels:['cr: ready']
    });
    octokit.issues.removeLabel({
        owner,
        repo,
        issue_number: pull_request.number,
        name: 'cr: none'
    });
} else if (action === 'labeled' && payload.label != null) {
    //If a label is added, all conflicting same-color labels should be removed
    //Label groups that begin with '*' will be ignored
    const label = payload.label;
    core.info(JSON.stringify(label));
    core.info("--------------");
    core.info(JSON.stringify(pull_request.labels));
    if (!label.name.startsWith("*")) {
        for (let current_label in pull_request.labels) {
            core.info("Comparing...");
            core.info(JSON.stringify(current_label));
            if (label.color === current_label.color) {
                core.info("Match");
                octokit.issues.removeLabel({
                    owner,
                    repo,
                    issue_number: pull_request.number,
                    name: current_label.name
                });
            }
        }
    }
} else if (action === 'submitted' && payload.review != null) {
    //A review has been submitted; check the number of approved reviews and update accordingly
    const reviews = octokit.pulls.listReviews({
        owner,
        repo,
        issue_number: pull_request.number
    });
    let approvals = 0;
    for (let review in reviews) {
        approvals += review.state.toUpperCase() == 'APPROVED';
    }
    if (approvals >= inputs.approval_count) {
        octokit.issues.addLabels({
            owner,
            repo,
            issue_number: pull_request.number,
            labels:['cr: completed']
        });

        // Leaving out removal to see if octokit triggers "labeled" action
    }
}