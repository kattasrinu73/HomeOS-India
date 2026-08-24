# Allure-Compatible Results

These JSON result files follow Allure result-file conventions and can be rendered with an Allure CLI installation:

```bash
allure generate allure-results --clean -o allure-report
allure open allure-report
```

The results distinguish passed automated validation from skipped physical-device and provider-dependent verification. See `../ALLURE_TESTING_REPORT.md` for the complete human-readable summary.
