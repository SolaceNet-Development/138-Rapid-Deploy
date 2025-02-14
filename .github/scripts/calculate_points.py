#!/usr/bin/env python3

import argparse
import json
import sys
from typing import Dict, List

class ContributionCalculator:
    def __init__(self, weights: Dict[str, int]):
        self.weights = weights
        self.contribution_types = {
            'code': self._calculate_code_points,
            'review': self._calculate_review_points,
            'documentation': self._calculate_documentation_points,
            'community': self._calculate_community_points
        }

    def _calculate_code_points(self, contribution: Dict) -> int:
        """Calculate points for code contributions."""
        points = 0
        additions = contribution.get('a', 0)
        deletions = contribution.get('d', 0)
        commits = contribution.get('c', 0)
        
        # Points for code changes
        points += (additions + deletions) // 100 * self.weights['code']
        # Points for commits
        points += commits * (self.weights['code'] // 2)
        
        return points

    def _calculate_review_points(self, contribution: Dict) -> int:
        """Calculate points for code review contributions."""
        points = 0
        reviews = contribution.get('reviews', 0)
        comments = contribution.get('review_comments', 0)
        
        # Points for reviews
        points += reviews * self.weights['review']
        # Points for detailed comments
        points += comments * (self.weights['review'] // 2)
        
        return points

    def _calculate_documentation_points(self, contribution: Dict) -> int:
        """Calculate points for documentation contributions."""
        points = 0
        doc_changes = contribution.get('doc_changes', 0)
        doc_reviews = contribution.get('doc_reviews', 0)
        
        # Points for documentation changes
        points += doc_changes * self.weights['documentation']
        # Points for documentation reviews
        points += doc_reviews * (self.weights['documentation'] // 2)
        
        return points

    def _calculate_community_points(self, contribution: Dict) -> int:
        """Calculate points for community contributions."""
        points = 0
        issues = contribution.get('issues', 0)
        discussions = contribution.get('discussions', 0)
        help_comments = contribution.get('help_comments', 0)
        
        # Points for issues and discussions
        points += issues * self.weights['community']
        points += discussions * self.weights['community']
        # Points for helpful comments
        points += help_comments * (self.weights['community'] // 2)
        
        return points

    def calculate_total_points(self, contributions: List[Dict]) -> Dict[str, int]:
        """Calculate total points for all contributors."""
        total_points = {}
        
        for contribution in contributions:
            username = contribution.get('author', {}).get('login')
            if not username:
                continue
                
            user_points = 0
            for contrib_type, calculator in self.contribution_types.items():
                user_points += calculator(contribution)
            
            total_points[username] = total_points.get(username, 0) + user_points
        
        return total_points

def main():
    parser = argparse.ArgumentParser(description='Calculate contributor points')
    parser.add_argument('--contributors', type=str, required=True,
                      help='JSON string of contributor data')
    parser.add_argument('--weights', type=str, required=True,
                      help='JSON string of contribution weights')
    
    args = parser.parse_args()
    
    try:
        contributors = json.loads(args.contributors)
        weights = json.loads(args.weights)
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON: {e}", file=sys.stderr)
        sys.exit(1)
    
    calculator = ContributionCalculator(weights)
    points = calculator.calculate_total_points(contributors)
    
    # Output points in JSON format
    print(json.dumps({"points": points}))

if __name__ == "__main__":
    main() 