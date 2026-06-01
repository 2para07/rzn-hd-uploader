# Simple Makefile for local development

.PHONY: build up down logs clean

build:
	docker-compose build

up:
	docker-compose up -d --build

down:
	docker-compose down

logs:
	docker-compose logs -f

clean:
	docker-compose down -v --rmi local --remove-orphans
	rm -rf uploads/* output/* || true
