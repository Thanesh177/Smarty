VOCAB_SOURCE_DIR := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))

build-ApiFunction:
	cp "$(VOCAB_SOURCE_DIR)/api.py" "$(VOCAB_SOURCE_DIR)/common.py" "$(ARTIFACTS_DIR)/"
	cp "$(VOCAB_SOURCE_DIR)/../ai-content/post_glossary.py" "$(ARTIFACTS_DIR)/post_glossary.py"

build-WorkerFunction:
	cp "$(VOCAB_SOURCE_DIR)/worker.py" "$(VOCAB_SOURCE_DIR)/common.py" "$(ARTIFACTS_DIR)/"
	cp "$(VOCAB_SOURCE_DIR)/../ai-content/post_glossary.py" "$(ARTIFACTS_DIR)/post_glossary.py"
