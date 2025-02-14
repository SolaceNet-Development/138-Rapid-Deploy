#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Functions
create_privacy_group() {
    local name=$1
    local members=$2
    echo -e "${GREEN}Creating privacy group: $name${NC}"
    curl -X POST --data '{
        "jsonrpc": "2.0",
        "method": "priv_createPrivacyGroup",
        "params": [
            {
                "name": "'$name'",
                "description": "Privacy group for '$name'",
                "members": ['$members']
            }
        ],
        "id": 1
    }' http://localhost:8545
}

delete_privacy_group() {
    local group_id=$1
    echo -e "${GREEN}Deleting privacy group: $group_id${NC}"
    curl -X POST --data '{
        "jsonrpc": "2.0",
        "method": "priv_deletePrivacyGroup",
        "params": ["'$group_id'"],
        "id": 1
    }' http://localhost:8545
}

find_privacy_group() {
    local members=$1
    echo -e "${GREEN}Finding privacy group for members: $members${NC}"
    curl -X POST --data '{
        "jsonrpc": "2.0",
        "method": "priv_findPrivacyGroup",
        "params": [['$members']],
        "id": 1
    }' http://localhost:8545
}

send_private_transaction() {
    local group_id=$1
    local to=$2
    local data=$3
    echo -e "${GREEN}Sending private transaction to group: $group_id${NC}"
    curl -X POST --data '{
        "jsonrpc": "2.0",
        "method": "eea_sendRawTransaction",
        "params": [{
            "privateFrom": "'$(cat data/chain138/privacy/tm.pub)'",
            "privateFor": ["'$group_id'"],
            "to": "'$to'",
            "data": "'$data'"
        }],
        "id": 1
    }' http://localhost:8545
}

get_private_transaction() {
    local tx_hash=$1
    local group_id=$2
    echo -e "${GREEN}Getting private transaction: $tx_hash${NC}"
    curl -X POST --data '{
        "jsonrpc": "2.0",
        "method": "priv_getPrivateTransaction",
        "params": ["'$tx_hash'", "'$group_id'"],
        "id": 1
    }' http://localhost:8545
}

# Main menu
while true; do
    echo -e "\n${YELLOW}Privacy Management Menu${NC}"
    echo "1. Create Privacy Group"
    echo "2. Delete Privacy Group"
    echo "3. Find Privacy Group"
    echo "4. Send Private Transaction"
    echo "5. Get Private Transaction"
    echo "6. Exit"
    read -p "Select an option: " option

    case $option in
        1)
            read -p "Enter group name: " name
            read -p "Enter members (comma-separated public keys): " members
            create_privacy_group "$name" "$members"
            ;;
        2)
            read -p "Enter group ID: " group_id
            delete_privacy_group "$group_id"
            ;;
        3)
            read -p "Enter members (comma-separated public keys): " members
            find_privacy_group "$members"
            ;;
        4)
            read -p "Enter group ID: " group_id
            read -p "Enter recipient address: " to
            read -p "Enter transaction data: " data
            send_private_transaction "$group_id" "$to" "$data"
            ;;
        5)
            read -p "Enter transaction hash: " tx_hash
            read -p "Enter group ID: " group_id
            get_private_transaction "$tx_hash" "$group_id"
            ;;
        6)
            echo -e "${GREEN}Exiting...${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid option${NC}"
            ;;
    esac
done 